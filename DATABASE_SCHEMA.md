# Simplified Database Schema for Messaging App

## Overview
This document describes the simplified database schema for the messaging app. The goal of the simplification was to reduce data complexity, eliminate redundancies, and improve overall data structure.

## Models

### 1. User Model (`userModel.js`)
- **Purpose**: Stores user information and their conversations.
- **Key Changes**:
  - Replaced `openChats` array with a more structured `conversations` array that includes unread counts and last viewed timestamps
  - Added helper methods for conversation management (`addConversation`, `markConversationAsRead`, `incrementUnreadCount`)
  - Added a `toClientJSON` method for consistent user data formatting
  - Created appropriate indexes for efficient querying

```javascript
{
  username: String,
  password: String (hashed),
  profilePicture: String,
  status: String (enum: 'online', 'offline', 'away', 'busy'),
  conversations: [
    {
      conversationId: ObjectId (ref: 'Conversation'),
      unreadCount: Number,
      lastViewedAt: Date
    }
  ],
  lastSeen: Date
}
```

### 2. Conversation Model (Formerly `channelModel.js`)
- **Purpose**: Unified model to handle both channels and direct messages.
- **Key Changes**:
  - Consolidated `channelModel.js` and `chatRoomModel.js` into a single model
  - Added a `type` field to distinguish between 'channel' and 'direct' conversations
  - Added helper methods for finding/creating conversations
  - Created indexes for efficient querying

```javascript
{
  name: String,
  displayName: String,
  type: String (enum: 'channel', 'direct'),
  description: String,
  icon: String,
  createdBy: ObjectId (ref: 'User'),
  participants: [ObjectId (ref: 'User')],
  isDefaultChannel: Boolean,
  lastActivity: Date,
  createdAt: Date
}
```

### 3. Message Model (`messageModel.js`)
- **Purpose**: Stores all messages (both channel and direct).
- **Key Changes**:
  - Replaced complex validation with simple `enum` validation
  - Moved `messageType` to a virtual field
  - Added an `isDeleted` flag instead of physically deleting messages
  - Added compound indexes for efficient querying
  - Simplified static methods and improved their performance

```javascript
{
  sender: ObjectId (ref: 'User'),
  receiver: ObjectId (ref: 'User') (optional),
  content: String,
  channel: String (enum: [...VALID_CHANNELS, null]),
  timestamp: Date,
  isDeleted: Boolean
}
```

## Benefits of the New Schema

1. **Reduced Redundancy**: Eliminated duplicate models and consolidated related functionality.
2. **Improved Data Structure**: Better organization of relationships between users, conversations, and messages.
3. **Enhanced Performance**: Added appropriate indexes and simplified queries.
4. **Better Maintainability**: Cleaner code structure with helper methods for common operations.
5. **Improved User Experience**: Added support for unread counts and tracking last viewed messages.

## Migration Notes

When migrating from the old schema to the new one:

1. Create the new Conversation documents from existing Channel and ChatRoom documents.
2. Update User documents to include the new conversations array structure.
3. Update Message documents to set the appropriate channel or receiver field based on the old messageType.
