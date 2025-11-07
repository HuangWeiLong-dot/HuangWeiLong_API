/**
 * Vercel Serverless Function - Main API Handler
 * 
 * This file exports an Express app as a serverless function for Vercel
 */

require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'Assets';
const PODCASTS_COLLECTION = 'podcasts';
const VIDEOS_COLLECTION = 'videos';
const MESSAGES_COLLECTION = 'messages';

// Configure MongoDB client
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Global connection variables
let db;
let isConnected = false;

// Connect to MongoDB (reuse connection)
async function connectDB() {
  if (isConnected && db) {
    return db;
  }

  try {
    await client.connect();
    db = client.db(DB_NAME);
    isConnected = true;
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isConnected ? 'connected' : 'disconnected'
  });
});

// Get all podcasts
app.get('/api/podcasts', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(PODCASTS_COLLECTION);
    const podcasts = await collection.find({}).sort({ date: -1 }).toArray();
    res.json(podcasts);
  } catch (error) {
    console.error('Error fetching podcasts:', error);
    res.status(503).json({ error: 'Service unavailable', message: error.message });
  }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(VIDEOS_COLLECTION);
    const videos = await collection.find({}).sort({ date: -1 }).toArray();
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(503).json({ error: 'Service unavailable', message: error.message });
  }
});

// Get podcast by ID
app.get('/api/podcasts/:id', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(PODCASTS_COLLECTION);
    const { ObjectId } = require('mongodb');
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const podcast = await collection.findOne(query);
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    res.json(podcast);
  } catch (error) {
    console.error('Error fetching podcast:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(VIDEOS_COLLECTION);
    const { ObjectId } = require('mongodb');
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const video = await collection.findOne(query);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const database = await connectDB();
    const collection = database.collection(MESSAGES_COLLECTION);

    const contactMessage = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: new Date(),
      read: false
    };

    const result = await collection.insertOne(contactMessage);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      id: result.insertedId
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get all messages (admin endpoint)
app.get('/api/messages', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(MESSAGES_COLLECTION);
    const messages = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get message by ID
app.get('/api/messages/:id', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(MESSAGES_COLLECTION);
    const { ObjectId } = require('mongodb');
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const message = await collection.findOne(query);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const database = await connectDB();
    const collection = database.collection(MESSAGES_COLLECTION);
    const { ObjectId } = require('mongodb');
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const result = await collection.updateOne(
      query,
      { $set: { read: true, readAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const database = await connectDB();
    const podcastsCollection = database.collection(PODCASTS_COLLECTION);
    const videosCollection = database.collection(VIDEOS_COLLECTION);
    
    const podcastCount = await podcastsCollection.countDocuments({});
    const videoCount = await videosCollection.countDocuments({});
    
    const firstPodcast = await podcastsCollection.findOne({});
    const firstVideo = await videosCollection.findOne({});
    
    const debugInfo = {
      connection: {
        database: DB_NAME,
        podcastsCollection: PODCASTS_COLLECTION,
        videosCollection: VIDEOS_COLLECTION,
        connected: isConnected
      },
      stats: {
        podcastCount,
        videoCount
      },
      samplePodcast: firstPodcast ? {
        _id: firstPodcast._id,
        keys: Object.keys(firstPodcast)
      } : null,
      sampleVideo: firstVideo ? {
        _id: firstVideo._id,
        keys: Object.keys(firstVideo)
      } : null
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(503).json({ 
      error: 'Debug error', 
      message: error.message
    });
  }
});

// Export the Express app as a serverless function
module.exports = app;

