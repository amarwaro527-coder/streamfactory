const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const socketService = require('./socketService');

class JobQueueService {
    constructor() {
        this.connection = null;
        this.queues = {};
        this.workers = {};
        this.isRedisAvailable = false;
    }

    /**
     * Initialize job queue service
     */
    async initialize() {
        const useQueue = process.env.USE_JOB_QUEUE === 'true';

        if (!useQueue) {
            console.log('ℹ️  Job queue disabled (USE_JOB_QUEUE=false)');
            this.isRedisAvailable = false;
            return;
        }

        try {
            // Try to connect to Redis
            this.connection = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                maxRetriesPerRequest: null,
                retryStrategy: (times) => {
                    if (times > 3) {
                        console.warn('⚠️  Redis connection failed, falling back to synchronous processing');
                        return null;
                    }
                    return Math.min(times * 100, 3000);
                }
            });

            await this.connection.ping();
            this.isRedisAvailable = true;
            console.log('✅ Redis connected - Job queue enabled');

            // Initialize queues
            this.queues.audio = new Queue('audio', { connection: this.connection });
            this.queues.video = new Queue('video', { connection: this.connection });
            this.queues.upload = new Queue('upload', { connection: this.connection });
            this.queues.ai = new Queue('ai', { connection: this.connection });

            console.log('✅ Job queues initialized');
        } catch (error) {
            console.warn('⚠️  Redis not available:', error.message);
            console.warn('⚠️  Falling back to synchronous processing');
            this.isRedisAvailable = false;
            this.connection = null;
        }
    }

    /**
     * Start workers for processing jobs
     */
    startWorkers(processors) {
        if (!this.isRedisAvailable) {
            console.log('ℹ️  Skipping workers (Redis not available)');
            return;
        }

        // Audio generation worker
        if (processors.audio) {
            this.workers.audio = new Worker('audio', async (job) => {
                return await this.processJob(job, processors.audio);
            }, { connection: this.connection });

            this.setupWorkerEvents(this.workers.audio, 'Audio');
        }

        // Video assembly worker
        if (processors.video) {
            this.workers.video = new Worker('video', async (job) => {
                return await this.processJob(job, processors.video);
            }, { connection: this.connection });

            this.setupWorkerEvents(this.workers.video, 'Video');
        }

        // Upload worker
        if (processors.upload) {
            this.workers.upload = new Worker('upload', async (job) => {
                return await this.processJob(job, processors.upload);
            }, { connection: this.connection });

            this.setupWorkerEvents(this.workers.upload, 'Upload');
        }

        // AI worker
        if (processors.ai) {
            this.workers.ai = new Worker('ai', async (job) => {
                return await this.processJob(job, processors.ai);
            }, { connection: this.connection });

            this.setupWorkerEvents(this.workers.ai, 'AI');
        }

        console.log('✅ Workers started');
    }

    /**
     * Process job with progress tracking
     */
    async processJob(job, processor) {
        const startTime = Date.now();
        console.log(`▶️  Processing job ${job.id} (${job.name})`);

        try {
            // Update progress callback
            const updateProgress = (progress, message) => {
                job.updateProgress(progress);
                socketService.emitJobProgress(job.id, {
                    progress,
                    status: 'processing',
                    message
                });
            };

            // Execute processor
            const result = await processor(job.data, updateProgress);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Job ${job.id} completed in ${duration}s`);

            // Emit completion event
            socketService.emitJobCompleted(job.id, result);

            return result;
        } catch (error) {
            console.error(`❌ Job ${job.id} failed:`, error);

            // Emit failure event
            socketService.emitJobFailed(job.id, error);

            throw error;
        }
    }

    /**
     * Setup worker event listeners
     */
    setupWorkerEvents(worker, name) {
        worker.on('completed', (job) => {
            console.log(`✅ ${name} job ${job.id} completed`);
        });

        worker.on('failed', (job, err) => {
            console.error(`❌ ${name} job ${job?.id} failed:`, err.message);
        });

        worker.on('progress', (job, progress) => {
            console.log(`⏳ ${name} job ${job.id}: ${progress}%`);
        });
    }

    /**
     * Add job to queue (or process synchronously if Redis not available)
     */
    async addJob(queueName, jobName, data, processor) {
        if (this.isRedisAvailable && this.queues[queueName]) {
            // Add to queue
            const job = await this.queues[queueName].add(jobName, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            });

            console.log(`📥 Job ${job.id} added to ${queueName} queue`);

            return {
                jobId: job.id,
                status: 'queued',
                message: 'Job queued for processing'
            };
        } else {
            // Process synchronously
            console.log(`⚡ Processing ${jobName} synchronously (no queue)`);

            try {
                const updateProgress = (progress, message) => {
                    console.log(`⏳ Progress: ${progress}% - ${message}`);
                };

                const result = await processor(data, updateProgress);

                return {
                    status: 'completed',
                    result,
                    message: 'Job completed synchronously'
                };
            } catch (error) {
                console.error(`❌ Synchronous job failed:`, error);
                return {
                    status: 'failed',
                    error: error.message,
                    message: 'Job failed'
                };
            }
        }
    }

    /**
     * Get job status
     */
    async getJobStatus(queueName, jobId) {
        if (!this.isRedisAvailable || !this.queues[queueName]) {
            return { status: 'unknown', message: 'Queue not available' };
        }

        const job = await this.queues[queueName].getJob(jobId);

        if (!job) {
            return { status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress;

        return {
            id: job.id,
            name: job.name,
            status: state,
            progress,
            data: job.data,
            returnvalue: job.returnvalue,
            failedReason: job.failedReason
        };
    }

    /**
     * Get queue info
     */
    async getQueueInfo(queueName) {
        if (!this.isRedisAvailable || !this.queues[queueName]) {
            return { available: false };
        }

        const queue = this.queues[queueName];

        return {
            available: true,
            waiting: await queue.getWaitingCount(),
            active: await queue.getActiveCount(),
            completed: await queue.getCompletedCount(),
            failed: await queue.getFailedCount()
        };
    }

    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.isRedisAvailable;
    }

    /**
     * Cleanup
     */
    async close() {
        if (this.connection) {
            await this.connection.quit();
        }

        for (const worker of Object.values(this.workers)) {
            await worker.close();
        }

        for (const queue of Object.values(this.queues)) {
            await queue.close();
        }

        console.log('✅ Job queue service closed');
    }
}

// Singleton instance
const jobQueueService = new JobQueueService();

module.exports = jobQueueService;
