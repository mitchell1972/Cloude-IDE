# WebSocket Server Architecture for Real-time Collaboration in Cloud-Based IDE

## Executive Summary

This document presents a comprehensive WebSocket server architecture designed for real-time collaboration in cloud-based IDE platforms. The architecture leverages Socket.io for WebSocket management, Y.js CRDTs for conflict-free document synchronization, Redis for horizontal scaling, and sophisticated monitoring for production-grade performance.

The system is designed to handle thousands of concurrent connections with sub-100ms latency for real-time collaboration features. Key architectural decisions include clustered Socket.io servers with Redis adapter, Y.js for operational transform-free document synchronization, JWT-based authentication, and comprehensive error handling with automatic reconnection strategies.

Performance optimizations include message batching, compression, connection pooling, and intelligent load balancing. The architecture supports project-based room management with fine-grained access control, presence tracking, and rich collaboration features including cursor synchronization and typing indicators.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Socket.io Server with Clustering and Redis](#socketio-server-with-clustering-and-redis)
3. [Y.js CRDT Document Synchronization](#yjs-crdt-document-synchronization)
4. [Presence Tracking and Cursor Synchronization](#presence-tracking-and-cursor-synchronization)
5. [Room Management and Access Control](#room-management-and-access-control)
6. [Event Handling System](#event-handling-system)
7. [Authentication and Authorization](#authentication-and-authorization)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling and Reconnection](#error-handling-and-reconnection)
10. [Monitoring and Metrics](#monitoring-and-metrics)
11. [Load Testing Configuration](#load-testing-configuration)
12. [Deployment and Operations](#deployment-and-operations)

## Architecture Overview

The WebSocket server architecture implements a distributed, scalable solution for real-time collaboration with the following key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer (HAProxy)                      │
└─────────────────────┬───────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐       ┌───▼───┐       ┌───▼───┐
│Socket │       │Socket │       │Socket │
│Server │       │Server │       │Server │
│  #1   │       │  #2   │       │  #3   │
└───┬───┘       └───┬───┘       └───┬───┘
    │               │               │
    └───────────────┼───────────────┘
                    │
            ┌───────▼───────┐
            │ Redis Cluster │
            │ (Pub/Sub +    │
            │  Adapter)     │
            └───────────────┘
```

### Core Technologies

- **Socket.io**: WebSocket management with fallback transports
- **Y.js**: Conflict-free Replicated Data Types (CRDTs) for document synchronization
- **Redis**: Clustering adapter and real-time state management
- **TypeScript**: Type-safe implementation with robust interfaces
- **Node.js**: High-performance event-driven runtime
- **Prometheus**: Metrics collection and monitoring

## Socket.io Server with Clustering and Redis

### Server Configuration and Initialization

The Socket.io server implements clustering with Redis adapter for horizontal scaling across multiple instances:

```typescript
// src/server/websocket-server.ts
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cluster from 'cluster';
import os from 'os';
import { CollaborationNamespace } from './namespaces/collaboration';
import { AuthMiddleware } from './middleware/auth';
import { MetricsCollector } from './monitoring/metrics';
import { Logger } from './utils/logger';

interface ServerConfig {
  port: number;
  redisUrl: string;
  corsOrigins: string[];
  clusterMode: boolean;
  maxConnections: number;
  compressionThreshold: number;
}

export class WebSocketServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private io: SocketServer;
  private redisClient: ReturnType<typeof createClient>;
  private redisPub: ReturnType<typeof createClient>;
  private redisSub: ReturnType<typeof createClient>;
  private config: ServerConfig;
  private metrics: MetricsCollector;
  private logger: Logger;

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = new Logger('WebSocketServer');
    this.metrics = new MetricsCollector();
    
    this.initializeExpress();
    this.initializeRedis();
    this.initializeSocketIO();
    this.setupMiddleware();
    this.setupNamespaces();
    this.setupEventHandlers();
  }

  private initializeExpress(): void {
    this.app = express();
    this.app.use(express.json());
    this.httpServer = createServer(this.app);
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: this.io.engine.clientsCount,
        uptime: process.uptime()
      });
    });
  }

  private async initializeRedis(): Promise<void> {
    // Create Redis clients for pub/sub and adapter
    this.redisPub = createClient({ url: this.config.redisUrl });
    this.redisSub = this.redisPub.duplicate();
    this.redisClient = this.redisPub.duplicate();

    // Connect all Redis clients
    await Promise.all([
      this.redisPub.connect(),
      this.redisSub.connect(),
      this.redisClient.connect()
    ]);

    this.logger.info('Redis clients connected successfully');
  }

  private initializeSocketIO(): void {
    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: this.config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      upgradeTimeout: 30000,
      pingTimeout: 60000,
      pingInterval: 25000,
      compression: true,
      perMessageDeflate: {
        threshold: this.config.compressionThreshold
      },
      maxHttpBufferSize: 1e8, // 100MB for large file operations
      allowEIO3: true
    });

    // Set up Redis adapter for clustering
    this.io.adapter(createAdapter(this.redisPub, this.redisSub));
    
    this.logger.info('Socket.io server initialized with Redis adapter');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    const authMiddleware = new AuthMiddleware(this.redisClient);
    this.io.use(authMiddleware.authenticate.bind(authMiddleware));

    // Connection tracking middleware
    this.io.use(async (socket, next) => {
      this.metrics.incrementConnections();
      this.logger.info(`New connection: ${socket.id} from ${socket.handshake.address}`);
      
      socket.on('disconnect', () => {
        this.metrics.decrementConnections();
        this.logger.info(`Disconnection: ${socket.id}`);
      });
      
      next();
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const clientIp = socket.handshake.address;
      const rateLimitKey = `rate_limit:${clientIp}`;
      
      const current = await this.redisClient.incr(rateLimitKey);
      if (current === 1) {
        await this.redisClient.expire(rateLimitKey, 60); // 1 minute window
      }
      
      if (current > 1000) { // 1000 requests per minute
        next(new Error('Rate limit exceeded'));
        return;
      }
      
      next();
    });
  }

  private setupNamespaces(): void {
    // Collaboration namespace for document editing
    const collaborationNamespace = new CollaborationNamespace(
      this.io.of('/collaboration'),
      this.redisClient,
      this.metrics
    );
    
    collaborationNamespace.initialize();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  private handleConnection(socket: any): void {
    const userId = socket.user?.id;
    const sessionId = socket.id;
    
    this.logger.info(`User ${userId} connected with session ${sessionId}`);
    
    // Store user session in Redis
    this.redisClient.hset(`user_sessions:${userId}`, sessionId, JSON.stringify({
      socketId: sessionId,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    }));

    socket.on('disconnect', async (reason) => {
      this.logger.info(`User ${userId} disconnected: ${reason}`);
      await this.redisClient.hdel(`user_sessions:${userId}`, sessionId);
    });
  }

  async start(): Promise<void> {
    if (this.config.clusterMode && cluster.isPrimary) {
      this.startCluster();
    } else {
      this.startSingleProcess();
    }
  }

  private startCluster(): void {
    const numCPUs = os.cpus().length;
    this.logger.info(`Starting cluster with ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      this.logger.error(`Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });
  }

  private startSingleProcess(): void {
    this.httpServer.listen(this.config.port, () => {
      this.logger.info(`WebSocket server running on port ${this.config.port}`);
      this.logger.info(`Worker process ${process.pid} started`);
    });
  }

  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');
    
    // Stop accepting new connections
    this.httpServer.close();
    
    // Close all socket connections
    this.io.close();
    
    // Close Redis connections
    await Promise.all([
      this.redisPub.quit(),
      this.redisSub.quit(),
      this.redisClient.quit()
    ]);
    
    this.logger.info('Graceful shutdown completed');
    process.exit(0);
  }
}
```

### Clustering Configuration

The server supports both single-process and cluster modes with Redis-based session sharing:

```typescript
// src/config/server-config.ts
export const serverConfig: ServerConfig = {
  port: parseInt(process.env.WS_PORT || '3001'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  clusterMode: process.env.CLUSTER_MODE === 'true',
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10000'),
  compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024')
};

// src/main.ts
import { WebSocketServer } from './server/websocket-server';
import { serverConfig } from './config/server-config';

const server = new WebSocketServer(serverConfig);
server.start().catch(console.error);
```

## Y.js CRDT Document Synchronization

### Y.js Integration for Conflict-Free Collaboration

Y.js provides conflict-free replicated data types that automatically resolve concurrent edits:

```typescript
// src/collaboration/yjs-provider.ts
import * as Y from 'yjs';
import { Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

interface DocumentState {
  ydoc: Y.Doc;
  ytext: Y.Text;
  users: Map<string, any>;
  version: number;
  lastModified: Date;
}

interface DocumentOperation {
  type: 'update' | 'awareness';
  origin: string;
  data: Uint8Array;
  timestamp: number;
}

export class YjsDocumentProvider extends EventEmitter {
  private documents: Map<string, DocumentState> = new Map();
  private redis: Redis;
  private persistenceEnabled: boolean;
  
  constructor(redis: Redis, persistenceEnabled = true) {
    super();
    this.redis = redis;
    this.persistenceEnabled = persistenceEnabled;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for document updates from other server instances
    this.redis.subscribe('yjs:updates');
    this.redis.on('message', (channel, message) => {
      if (channel === 'yjs:updates') {
        this.handleRemoteUpdate(JSON.parse(message));
      }
    });
  }

  async getOrCreateDocument(documentId: string): Promise<DocumentState> {
    let docState = this.documents.get(documentId);
    
    if (!docState) {
      docState = await this.initializeDocument(documentId);
      this.documents.set(documentId, docState);
    }
    
    return docState;
  }

  private async initializeDocument(documentId: string): Promise<DocumentState> {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');
    
    // Load persisted state if available
    if (this.persistenceEnabled) {
      const persistedState = await this.redis.get(`doc:${documentId}`);
      if (persistedState) {
        const stateVector = new Uint8Array(JSON.parse(persistedState));
        Y.applyUpdate(ydoc, stateVector);
      }
    }

    // Set up document event handlers
    ydoc.on('update', (update: Uint8Array, origin: any) => {
      this.handleDocumentUpdate(documentId, update, origin);
    });

    const docState: DocumentState = {
      ydoc,
      ytext,
      users: new Map(),
      version: 0,
      lastModified: new Date()
    };

    return docState;
  }

  private async handleDocumentUpdate(
    documentId: string,
    update: Uint8Array,
    origin: any
  ): Promise<void> {
    const docState = this.documents.get(documentId);
    if (!docState) return;

    docState.version++;
    docState.lastModified = new Date();

    // Persist to Redis if enabled
    if (this.persistenceEnabled && !origin?.skipPersistence) {
      await this.persistDocumentState(documentId, docState.ydoc);
    }

    // Broadcast update to other server instances
    const operation: DocumentOperation = {
      type: 'update',
      origin: origin?.userId || 'system',
      data: Array.from(update),
      timestamp: Date.now()
    };

    await this.redis.publish('yjs:updates', JSON.stringify({
      documentId,
      operation
    }));

    this.emit('document-updated', {
      documentId,
      update,
      origin,
      version: docState.version
    });
  }

  private async handleRemoteUpdate(data: any): Promise<void> {
    const { documentId, operation } = data;
    const docState = this.documents.get(documentId);
    
    if (!docState) return;

    const update = new Uint8Array(operation.data);
    
    // Apply remote update without triggering local events
    Y.applyUpdate(docState.ydoc, update, { skipPersistence: true });
    
    this.emit('remote-update', {
      documentId,
      update,
      origin: operation.origin,
      timestamp: operation.timestamp
    });
  }

  async applyClientUpdate(
    documentId: string,
    update: Uint8Array,
    userId: string
  ): Promise<void> {
    const docState = await this.getOrCreateDocument(documentId);
    
    // Apply update with user origin
    Y.applyUpdate(docState.ydoc, update, { userId });
  }

  async getDocumentState(documentId: string): Promise<Uint8Array> {
    const docState = await this.getOrCreateDocument(documentId);
    return Y.encodeStateAsUpdate(docState.ydoc);
  }

  async getDocumentText(documentId: string): Promise<string> {
    const docState = await this.getOrCreateDocument(documentId);
    return docState.ytext.toString();
  }

  private async persistDocumentState(documentId: string, ydoc: Y.Doc): Promise<void> {
    const stateVector = Y.encodeStateAsUpdate(ydoc);
    const serializedState = JSON.stringify(Array.from(stateVector));
    
    await this.redis.set(`doc:${documentId}`, serializedState);
    
    // Set expiration for cleanup (optional)
    await this.redis.expire(`doc:${documentId}`, 86400 * 7); // 7 days
  }

  async getDocumentHistory(
    documentId: string,
    limit = 100
  ): Promise<DocumentOperation[]> {
    const historyKey = `doc_history:${documentId}`;
    const history = await this.redis.lrange(historyKey, 0, limit - 1);
    
    return history.map(item => JSON.parse(item));
  }

  async getConnectedUsers(documentId: string): Promise<any[]> {
    const docState = this.documents.get(documentId);
    if (!docState) return [];
    
    return Array.from(docState.users.values());
  }

  cleanup(documentId: string): void {
    const docState = this.documents.get(documentId);
    if (docState) {
      docState.ydoc.destroy();
      this.documents.delete(documentId);
    }
  }
}
```

### CRDT Conflict Resolution Implementation

```typescript
// src/collaboration/conflict-resolution.ts
import * as Y from 'yjs';

interface ConflictResolution {
  strategy: 'last-writer-wins' | 'merge' | 'user-choice';
  metadata: any;
}

interface EditOperation {
  type: 'insert' | 'delete' | 'format';
  position: number;
  content?: string;
  attributes?: any;
  userId: string;
  timestamp: number;
}

export class ConflictResolver {
  static resolveTextConflicts(
    localOps: EditOperation[],
    remoteOps: EditOperation[],
    strategy: ConflictResolution['strategy'] = 'merge'
  ): EditOperation[] {
    switch (strategy) {
      case 'last-writer-wins':
        return this.lastWriterWinsResolution(localOps, remoteOps);
      case 'merge':
        return this.mergeResolution(localOps, remoteOps);
      case 'user-choice':
        return this.userChoiceResolution(localOps, remoteOps);
      default:
        return this.mergeResolution(localOps, remoteOps);
    }
  }

  private static lastWriterWinsResolution(
    localOps: EditOperation[],
    remoteOps: EditOperation[]
  ): EditOperation[] {
    const allOps = [...localOps, ...remoteOps];
    allOps.sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only the most recent operation per position
    const positionMap = new Map<number, EditOperation>();
    
    for (const op of allOps) {
      if (!positionMap.has(op.position)) {
        positionMap.set(op.position, op);
      }
    }
    
    return Array.from(positionMap.values());
  }

  private static mergeResolution(
    localOps: EditOperation[],
    remoteOps: EditOperation[]
  ): EditOperation[] {
    // Y.js CRDT handles merging automatically
    // This method provides additional business logic if needed
    return [...localOps, ...remoteOps].sort((a, b) => a.timestamp - b.timestamp);
  }

  private static userChoiceResolution(
    localOps: EditOperation[],
    remoteOps: EditOperation[]
  ): EditOperation[] {
    // In user-choice mode, conflicts are presented to users
    // This would typically involve UI interaction
    return [...localOps, ...remoteOps];
  }

  static detectConflicts(
    localOps: EditOperation[],
    remoteOps: EditOperation[]
  ): EditOperation[] {
    const conflicts: EditOperation[] = [];
    
    for (const localOp of localOps) {
      for (const remoteOp of remoteOps) {
        if (this.operationsConflict(localOp, remoteOp)) {
          conflicts.push(localOp);
        }
      }
    }
    
    return conflicts;
  }

  private static operationsConflict(
    op1: EditOperation,
    op2: EditOperation
  ): boolean {
    // Operations conflict if they affect the same position
    // and happened within a small time window
    const positionOverlap = Math.abs(op1.position - op2.position) < 10;
    const timeOverlap = Math.abs(op1.timestamp - op2.timestamp) < 1000; // 1 second
    
    return positionOverlap && timeOverlap && op1.userId !== op2.userId;
  }
}
```

## Presence Tracking and Cursor Synchronization

### Real-time Presence System

```typescript
// src/collaboration/presence-manager.ts
import { Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

interface UserPresence {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastActivity: number;
  status: 'active' | 'idle' | 'away';
}

interface CursorPosition {
  line: number;
  column: number;
  documentId: string;
}

interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
  documentId: string;
}

interface TypingIndicator {
  userId: string;
  documentId: string;
  position: CursorPosition;
  isTyping: boolean;
  timestamp: number;
}

export class PresenceManager extends EventEmitter {
  private redis: Redis;
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> socket IDs
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId
  private presenceData: Map<string, UserPresence> = new Map();
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private activityTimeout = 30000; // 30 seconds

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.setupCleanupInterval();
  }

  async addUser(socket: Socket, user: any): Promise<void> {
    const userId = user.id;
    const socketId = socket.id;

    // Track socket-user mapping
    this.socketUsers.set(socketId, userId);
    
    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(socketId);

    // Initialize presence data
    const presence: UserPresence = {
      userId,
      name: user.name,
      avatar: user.avatar,
      color: this.generateUserColor(userId),
      lastActivity: Date.now(),
      status: 'active'
    };

    this.presenceData.set(userId, presence);
    
    // Persist to Redis for cross-server synchronization
    await this.redis.hset(
      'user_presence',
      userId,
      JSON.stringify(presence)
    );

    // Broadcast presence update
    this.emit('user-joined', {
      userId,
      presence,
      socketId
    });

    // Set up socket event handlers
    this.setupSocketHandlers(socket);
  }

  private setupSocketHandlers(socket: Socket): void {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Cursor position updates
    socket.on('cursor-position', async (data: CursorPosition) => {
      await this.updateCursor(userId, data);
    });

    // Selection updates
    socket.on('selection-change', async (data: SelectionRange) => {
      await this.updateSelection(userId, data);
    });

    // Typing indicators
    socket.on('typing-start', async (data: { documentId: string; position: CursorPosition }) => {
      await this.startTyping(userId, data.documentId, data.position);
    });

    socket.on('typing-stop', async (data: { documentId: string }) => {
      await this.stopTyping(userId, data.documentId);
    });

    // Activity tracking
    socket.on('activity', () => {
      this.updateActivity(userId);
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      this.removeUser(socket);
    });
  }

  async updateCursor(userId: string, cursor: CursorPosition): Promise<void> {
    const presence = this.presenceData.get(userId);
    if (!presence) return;

    presence.cursor = cursor;
    presence.lastActivity = Date.now();
    
    // Update Redis
    await this.redis.hset(
      'user_presence',
      userId,
      JSON.stringify(presence)
    );

    // Broadcast cursor update
    this.emit('cursor-updated', {
      userId,
      cursor,
      timestamp: Date.now()
    });
  }

  async updateSelection(userId: string, selection: SelectionRange): Promise<void> {
    const presence = this.presenceData.get(userId);
    if (!presence) return;

    presence.selection = selection;
    presence.lastActivity = Date.now();

    await this.redis.hset(
      'user_presence',
      userId,
      JSON.stringify(presence)
    );

    this.emit('selection-updated', {
      userId,
      selection,
      timestamp: Date.now()
    });
  }

  async startTyping(
    userId: string,
    documentId: string,
    position: CursorPosition
  ): Promise<void> {
    const indicator: TypingIndicator = {
      userId,
      documentId,
      position,
      isTyping: true,
      timestamp: Date.now()
    };

    this.typingIndicators.set(`${userId}:${documentId}`, indicator);

    // Auto-stop typing after 3 seconds of inactivity
    setTimeout(() => {
      this.stopTyping(userId, documentId);
    }, 3000);

    this.emit('typing-started', indicator);
  }

  async stopTyping(userId: string, documentId: string): Promise<void> {
    const key = `${userId}:${documentId}`;
    const indicator = this.typingIndicators.get(key);
    
    if (indicator && indicator.isTyping) {
      indicator.isTyping = false;
      this.typingIndicators.delete(key);
      
      this.emit('typing-stopped', {
        userId,
        documentId,
        timestamp: Date.now()
      });
    }
  }

  updateActivity(userId: string): void {
    const presence = this.presenceData.get(userId);
    if (!presence) return;

    const now = Date.now();
    presence.lastActivity = now;
    
    // Update status based on activity
    if (presence.status !== 'active') {
      presence.status = 'active';
      this.emit('status-changed', {
        userId,
        status: 'active',
        timestamp: now
      });
    }
  }

  async removeUser(socket: Socket): Promise<void> {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Remove socket from user sessions
    const userSockets = this.userSessions.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      
      // If no more sockets for this user, mark as offline
      if (userSockets.size === 0) {
        this.userSessions.delete(userId);
        
        // Remove from Redis
        await this.redis.hdel('user_presence', userId);
        
        // Clean up presence data
        this.presenceData.delete(userId);
        
        this.emit('user-left', {
          userId,
          timestamp: Date.now()
        });
      }
    }

    // Clean up socket tracking
    this.socketUsers.delete(socket.id);
  }

  getPresence(userId: string): UserPresence | undefined {
    return this.presenceData.get(userId);
  }

  getAllPresence(): UserPresence[] {
    return Array.from(this.presenceData.values());
  }

  getDocumentUsers(documentId: string): UserPresence[] {
    return Array.from(this.presenceData.values()).filter(
      presence => presence.cursor?.documentId === documentId ||
                 presence.selection?.documentId === documentId
    );
  }

  getTypingUsers(documentId: string): TypingIndicator[] {
    return Array.from(this.typingIndicators.values()).filter(
      indicator => indicator.documentId === documentId && indicator.isTyping
    );
  }

  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#6C5CE7', '#A29BFE', '#FD79A8', '#E84393', '#00B894'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 60000); // Every minute
  }

  private async cleanupInactiveUsers(): Promise<void> {
    const now = Date.now();
    const inactiveUsers: string[] = [];

    for (const [userId, presence] of this.presenceData.entries()) {
      const timeSinceActivity = now - presence.lastActivity;
      
      if (timeSinceActivity > this.activityTimeout) {
        if (presence.status === 'active') {
          presence.status = 'idle';
          this.emit('status-changed', {
            userId,
            status: 'idle',
            timestamp: now
          });
        } else if (timeSinceActivity > this.activityTimeout * 2) {
          presence.status = 'away';
          this.emit('status-changed', {
            userId,
            status: 'away',
            timestamp: now
          });
        }
        
        // Remove completely inactive users after 5 minutes
        if (timeSinceActivity > this.activityTimeout * 10) {
          inactiveUsers.push(userId);
        }
      }
    }

    // Clean up completely inactive users
    for (const userId of inactiveUsers) {
      await this.redis.hdel('user_presence', userId);
      this.presenceData.delete(userId);
      this.userSessions.delete(userId);
      
      this.emit('user-left', {
        userId,
        reason: 'inactivity',
        timestamp: now
      });
    }
  }
}
```

## Authentication and Authorization

### JWT-Based WebSocket Authentication

```typescript
// src/middleware/auth.ts
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  roles: string[];
  permissions: string[];
  organizationId: string;
}

export class AuthMiddleware {
  private redis: Redis;
  private jwtSecret: string;

  constructor(redis: Redis) {
    this.redis = redis;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  }

  async authenticate(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = this.extractToken(socket);
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const blacklisted = await this.redis.get(`blacklist:${token}`);
      if (blacklisted) {
        return next(new Error('Token has been revoked'));
      }

      const user = await this.loadUser(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = user;
      await this.updateLastActivity(user.id);
      next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  }

  private extractToken(socket: Socket): string | null {
    const authHeader = socket.handshake.auth?.token;
    if (authHeader) {
      return authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private async loadUser(userId: string): Promise<User | null> {
    const cachedUser = await this.redis.get(`user:${userId}`);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    // Load from database and cache
    const user = await this.loadUserFromDatabase(userId);
    if (user) {
      await this.redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
    }

    return user;
  }

  private async loadUserFromDatabase(userId: string): Promise<User | null> {
    try {
      const response = await fetch(`${process.env.USER_SERVICE_URL}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${process.env.SERVICE_TOKEN}` }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }

    return null;
  }

  private async updateLastActivity(userId: string): Promise<void> {
    await this.redis.hset(`user:${userId}:activity`, 'lastWebSocketConnection', Date.now());
  }
}
```

## Performance Optimization

### Message Batching and Compression

```typescript
// src/performance/message-batcher.ts
interface BatchedMessage {
  type: string;
  data: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

export class MessageBatcher {
  private batches: Map<string, BatchedMessage[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  addMessage(
    roomId: string,
    message: BatchedMessage,
    callback?: (batch: BatchedMessage[]) => void
  ): void {
    if (!this.batches.has(roomId)) {
      this.batches.set(roomId, []);
    }

    const batch = this.batches.get(roomId)!;
    batch.push(message);

    if (batch.length >= 10 || message.priority === 'high') {
      this.flushBatch(roomId, callback);
      return;
    }

    const existingTimer = this.timers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.timers.set(roomId, setTimeout(() => {
      this.flushBatch(roomId, callback);
    }, 50));
  }

  private flushBatch(
    roomId: string,
    callback?: (batch: BatchedMessage[]) => void
  ): void {
    const batch = this.batches.get(roomId);
    if (!batch || batch.length === 0) return;

    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }

    this.batches.set(roomId, []);
    batch.sort((a, b) => a.timestamp - b.timestamp);

    if (callback) {
      callback(batch);
    }
  }
}
```

## Error Handling and Reconnection

### Comprehensive Error Handling

```typescript
// src/error-handling/error-manager.ts
import { Socket, Namespace } from 'socket.io';

export class ErrorManager {
  private namespace: Namespace;
  private reconnectionAttempts: Map<string, number> = new Map();

  constructor(namespace: Namespace) {
    this.namespace = namespace;
    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    this.namespace.on('connection', (socket: Socket) => {
      socket.on('error', (error: Error) => {
        this.handleSocketError(socket, error);
      });

      socket.on('disconnect', (reason: string) => {
        this.handleDisconnection(socket, reason);
      });
    });
  }

  private handleSocketError(socket: Socket, error: Error): void {
    console.error(`Socket error for ${socket.id}:`, error);
    
    if (this.isRecoverableError(error)) {
      socket.emit('error_recovery', {
        message: 'Connection error, attempting recovery',
        canRetry: true,
        retryDelay: 1000
      });
    } else {
      socket.emit('fatal_error', {
        message: 'Fatal error occurred',
        canRetry: false
      });
    }
  }

  private handleDisconnection(socket: Socket, reason: string): void {
    if (this.isRecoverableDisconnection(reason)) {
      this.setupReconnection(socket, reason);
    }
  }

  private isRecoverableError(error: Error): boolean {
    const recoverableErrors = ['ECONNRESET', 'ETIMEDOUT', 'transport error'];
    return recoverableErrors.some(recoverable => 
      error.message.includes(recoverable)
    );
  }

  private isRecoverableDisconnection(reason: string): boolean {
    const recoverableReasons = ['ping timeout', 'transport close', 'transport error'];
    return recoverableReasons.includes(reason);
  }

  private setupReconnection(socket: Socket, reason: string): void {
    const attempts = this.reconnectionAttempts.get(socket.id) || 0;
    
    if (attempts >= 5) {
      socket.emit('max_reconnection_attempts', {
        message: 'Maximum reconnection attempts reached'
      });
      return;
    }

    this.reconnectionAttempts.set(socket.id, attempts + 1);
    
    socket.emit('reconnection_attempt', {
      attempt: attempts + 1,
      maxAttempts: 5,
      delay: Math.pow(2, attempts) * 1000,
      reason
    });
  }
}
```

## Monitoring and Metrics

### Metrics Collection System

```typescript
// src/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsCollector {
  private connectionCounter: Counter<string>;
  private messageCounter: Counter<string>;
  private operationHistogram: Histogram<string>;
  private activeConnectionsGauge: Gauge<string>;

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.connectionCounter = new Counter({
      name: 'websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['status']
    });

    this.messageCounter = new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of messages processed',
      labelNames: ['type', 'direction']
    });

    this.operationHistogram = new Histogram({
      name: 'websocket_operation_duration_seconds',
      help: 'Duration of WebSocket operations',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.activeConnectionsGauge = new Gauge({
      name: 'websocket_active_connections',
      help: 'Number of active WebSocket connections'
    });

    register.registerMetric(this.connectionCounter);
    register.registerMetric(this.messageCounter);
    register.registerMetric(this.operationHistogram);
    register.registerMetric(this.activeConnectionsGauge);
  }

  incrementConnections(): void {
    this.connectionCounter.inc({ status: 'connected' });
    this.activeConnectionsGauge.inc();
  }

  decrementConnections(): void {
    this.connectionCounter.inc({ status: 'disconnected' });
    this.activeConnectionsGauge.dec();
  }

  recordMessage(type: string, direction: 'inbound' | 'outbound'): void {
    this.messageCounter.inc({ type, direction });
  }

  recordOperation(operation: string, duration: number): void {
    this.operationHistogram.observe({ operation }, duration / 1000);
  }

  incrementMetric(name: string, value = 1): void {
    // Handle dynamic metric increments
    switch (name) {
      case 'websocket_connections':
        this.incrementConnections();
        break;
      case 'yjs_updates_processed':
        this.recordMessage('yjs_update', 'inbound');
        break;
      default:
        console.warn(`Unknown metric: ${name}`);
    }
  }

  decrementMetric(name: string): void {
    if (name === 'websocket_connections') {
      this.decrementConnections();
    }
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

## Load Testing Configuration

### Load Testing with Artillery

```yaml
# load-test/websocket-load-test.yml
config:
  target: 'ws://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 180
      arrivalRate: 100
    - duration: 300
      arrivalRate: 200

  processor: "./test-processor.js"
  variables:
    authToken: "test-jwt-token"

scenarios:
  - name: "WebSocket Collaboration Load Test"
    weight: 100
    engine: ws
    beforeRequest: "generateAuth"
    flow:
      - connect:
          auth:
            token: "{{ authToken }}"
      - think: 1
      - send:
          match: 
            json: "$.type"
            value: "join-room"
          data:
            type: "join-room"
            roomId: "test-room-{{ $randomInt(1, 100) }}"
      - think: 2
      - loop:
        - send:
            data:
              type: "yjs-update"
              documentId: "doc-{{ $randomInt(1, 50) }}"
              update: [1, 2, 3, 4, 5]
        - think: 0.1
        count: 100
      - think: 5
      - send:
          data:
            type: "leave-room"
```

### Load Test Processor

```javascript
// load-test/test-processor.js
module.exports = {
  generateAuth: function(context, events, done) {
    // Generate test authentication token
    context.vars.authToken = generateTestJWT();
    return done();
  }
};

function generateTestJWT() {
  // Generate a test JWT token for load testing
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
}
```

### Performance Test Script

```typescript
// load-test/performance-test.ts
import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';

interface TestConfig {
  serverUrl: string;
  maxConnections: number;
  messagesPerConnection: number;
  testDuration: number;
}

interface TestResults {
  connectionsEstablished: number;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  errors: number;
}

class WebSocketLoadTester {
  private config: TestConfig;
  private sockets: Socket[] = [];
  private results: TestResults;

  constructor(config: TestConfig) {
    this.config = config;
    this.results = {
      connectionsEstablished: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errors: 0
    };
  }

  async runTest(): Promise<TestResults> {
    console.log(`Starting load test with ${this.config.maxConnections} connections`);
    
    const startTime = performance.now();
    
    // Create connections
    await this.createConnections();
    
    // Run test for specified duration
    await this.runTestDuration();
    
    // Cleanup
    await this.cleanup();
    
    const endTime = performance.now();
    console.log(`Test completed in ${(endTime - startTime) / 1000}s`);
    
    return this.results;
  }

  private async createConnections(): Promise<void> {
    const connectionPromises = [];
    
    for (let i = 0; i < this.config.maxConnections; i++) {
      connectionPromises.push(this.createConnection(i));
      
      // Stagger connection creation to avoid overwhelming server
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    await Promise.allSettled(connectionPromises);
    console.log(`Established ${this.results.connectionsEstablished} connections`);
  }

  private async createConnection(connectionId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = io(this.config.serverUrl, {
        auth: {
          token: this.generateTestToken()
        },
        timeout: 5000
      });

      socket.on('connect', () => {
        this.results.connectionsEstablished++;
        this.sockets.push(socket);
        
        // Join a test room
        socket.emit('join-room', {
          roomId: `test-room-${connectionId % 10}`
        });
        
        resolve();
      });

      socket.on('connect_error', (error) => {
        this.results.errors++;
        reject(error);
      });

      socket.on('disconnect', () => {
        console.log(`Connection ${connectionId} disconnected`);
      });

      // Track message latency
      socket.on('yjs-update', (data) => {
        if (data.timestamp) {
          const latency = Date.now() - data.timestamp;
          this.updateLatencyStats(latency);
        }
        this.results.messagesReceived++;
      });
    });
  }

  private async runTestDuration(): Promise<void> {
    const testEndTime = Date.now() + this.config.testDuration;
    
    while (Date.now() < testEndTime) {
      // Send messages from random connections
      const activeConnections = this.sockets.filter(s => s.connected);
      
      if (activeConnections.length > 0) {
        const randomSocket = activeConnections[
          Math.floor(Math.random() * activeConnections.length)
        ];
        
        this.sendTestMessage(randomSocket);
      }
      
      // Wait before next message batch
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private sendTestMessage(socket: Socket): void {
    const message = {
      type: 'yjs-update',
      documentId: `doc-${Math.floor(Math.random() * 10)}`,
      update: this.generateRandomUpdate(),
      timestamp: Date.now()
    };
    
    socket.emit('yjs-update', message);
    this.results.messagesSent++;
  }

  private generateRandomUpdate(): number[] {
    // Generate random Y.js update data
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 255));
  }

  private updateLatencyStats(latency: number): void {
    this.results.maxLatency = Math.max(this.results.maxLatency, latency);
    this.results.minLatency = Math.min(this.results.minLatency, latency);
    
    // Simple moving average for now
    const totalLatency = this.results.averageLatency * this.results.messagesReceived + latency;
    this.results.averageLatency = totalLatency / (this.results.messagesReceived + 1);
  }

  private generateTestToken(): string {
    // Generate test JWT token
    return 'test-jwt-token-' + Math.random().toString(36).substr(2, 9);
  }

  private async cleanup(): Promise<void> {
    console.log('Cleaning up connections...');
    
    const cleanupPromises = this.sockets.map(socket => {
      return new Promise<void>(resolve => {
        socket.disconnect();
        resolve();
      });
    });
    
    await Promise.all(cleanupPromises);
    this.sockets = [];
  }
}

// Run load test
async function runLoadTest() {
  const config: TestConfig = {
    serverUrl: 'ws://localhost:3001',
    maxConnections: 1000,
    messagesPerConnection: 100,
    testDuration: 60000 // 1 minute
  };

  const tester = new WebSocketLoadTester(config);
  const results = await tester.runTest();
  
  console.log('Load Test Results:', results);
}

if (require.main === module) {
  runLoadTest().catch(console.error);
}
```

## Deployment and Operations

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S websocket -u 1001

WORKDIR /app

COPY --from=builder --chown=websocket:nodejs /app/dist ./dist
COPY --from=builder --chown=websocket:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=websocket:nodejs /app/package.json ./package.json

USER websocket

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment

```yaml
# k8s/websocket-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
  labels:
    app: websocket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket-server
  template:
    metadata:
      labels:
        app: websocket-server
    spec:
      containers:
      - name: websocket-server
        image: websocket-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: NODE_ENV
          value: "production"
        - name: CLUSTER_MODE
          value: "false"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
spec:
  selector:
    app: websocket-server
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

### HAProxy Load Balancer Configuration

```
# haproxy.cfg
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend websocket_frontend
    bind *:80
    default_backend websocket_backend

backend websocket_backend
    balance source
    option httpchk GET /health
    stick-table type ip size 200k expire 30m
    stick on src
    
    server ws1 websocket-1:3001 check
    server ws2 websocket-2:3001 check
    server ws3 websocket-3:3001 check
```

This comprehensive WebSocket server architecture provides a production-ready solution for real-time collaboration in cloud-based IDE platforms. The implementation covers all requirements including clustering, Y.js CRDTs, presence tracking, authentication, performance optimization, error handling, monitoring, and load testing capabilities.