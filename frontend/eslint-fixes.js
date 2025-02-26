// ESLint fixes for DirectMessages.js

// 1. Remove unused isTyping variable (line 18)
// Replace:
// const [isTyping, setIsTyping] = useState(false);
// With nothing or comment it out

// 2. Remove SOCKET_URL from dependency arrays (lines 67, 89, 116, 154, 186)
// e.g. change [failedImages, SOCKET_URL] to [failedImages]
// e.g. change [user?.token, SOCKET_URL] to [user?.token]

// 3. Add missing dependencies to useEffect at line 290
// Change: [user?.token, navigate, fetchUsers, fetchOpenChats, updateOpenChats]
// To: [user?.token, navigate, fetchUsers, fetchOpenChats, updateOpenChats, logout]

// 4. Add missing dependencies to useEffect at line 438
// Change: [socket, user, selectedUser, addToOpenChats, scrollToBottom, fetchUsers, addNotification, addUnreadMessage]
// To: [socket, user, selectedUser, addToOpenChats, scrollToBottom, fetchUsers, addNotification, addUnreadMessage, activeChats, users]
