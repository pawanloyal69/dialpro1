import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { format } from 'date-fns';

const Messages = () => {
  const [myNumbers, setMyNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(''); // For preview only
  const [recipientNumber, setRecipientNumber] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  const textareaRef = useRef(null);
  const newTextareaRef = useRef(null);

  // ... (keep all your existing functions: getContactNumber, loadMyNumbers, loadConversations, loadConversation, useEffect)

  // ⭐ The key: handle paste to preserve newlines
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    // Insert the plain text with newlines
    const target = e.currentTarget;
    target.value = pastedText;
    // Trigger input event so preview updates
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const handleInput = (e) => {
    setNewMessage(e.target.value);
  };

  const handleSendMessage = useCallback(async () => {
    const activeRef = selectedConversation ? textareaRef : newTextareaRef;
    const rawMessage = activeRef.current ? activeRef.current.value : '';

    const toNumber = showNewMessage ? recipientNumber : selectedConversation;
    if (!selectedNumber || !toNumber || !rawMessage.trim()) {
      toast.error('Please enter recipient and message');
      return;
    }

    console.log('🔍 SENDING RAW MESSAGE:', JSON.stringify(rawMessage));
    console.log('📊 Contains \\n?', rawMessage.includes('\n') ? '✅ YES' : '❌ NO');

    try {
      await api.post('/messages/send', {
        from_number: selectedNumber,
        to_number: toNumber,
        body: rawMessage   // Send raw text with newlines
      });
      toast.success('Message sent');
      if (activeRef.current) activeRef.current.value = '';
      setNewMessage('');
      setRecipientNumber('');
      setShowNewMessage(false);
      if (selectedConversation) {
        loadConversation(selectedConversation);
      } else {
        loadConversations();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send message');
    }
  }, [selectedNumber, selectedConversation, recipientNumber, showNewMessage, loadConversation, loadConversations]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderTextarea = (ref, placeholder) => (
    <textarea
      ref={ref}
      placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}  // 🔥 This forces newlines
      rows={3}
      className="flex-1 min-h-[60px] rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical whitespace-pre-wrap"
    />
  );

  return (
    <Card>
      <CardHeader className="flex justify-between flex-row items-center">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Messages
        </CardTitle>
        <Button size="sm" onClick={() => setShowNewMessage(!showNewMessage)}>
          New SMS
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <Select value={selectedNumber} onValueChange={setSelectedNumber}>
          <SelectTrigger>
            <SelectValue placeholder="Select your number" />
          </SelectTrigger>
          <SelectContent>
            {myNumbers.map(num => (
              <SelectItem key={num} value={num}>
                {num}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showNewMessage && (
          <div className="space-y-2">
            <Input
              placeholder="Recipient number"
              value={recipientNumber}
              onChange={e => setRecipientNumber(e.target.value)}
            />
            <div className="flex gap-2">
              {renderTextarea(newTextareaRef, 'Message')}
              <Button type="button" onClick={handleSendMessage} className="self-end">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Preview: {newMessage.replace(/\n/g, ' ↵ ')}
            </div>
          </div>
        )}

        {selectedConversation && (
          <>
            <div className="flex justify-between items-center">
              <span className="font-mono">{selectedConversation}</span>
              <Button size="sm" variant="outline" onClick={() => setSelectedConversation(null)}>
                Back
              </Button>
            </div>

            <div className="border rounded p-3 max-h-80 overflow-y-auto space-y-2">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`p-2 rounded max-w-[70%] ${msg.direction === 'outbound' ? 'bg-primary text-white' : 'bg-muted'}`}>
                    <p className="text-[10px] opacity-60 mb-1">{msg.direction === 'inbound' ? 'Received' : 'Sent'}</p>
                    <div className="whitespace-pre-wrap">{msg.body}</div>
                    <p className="text-xs opacity-70">
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              {renderTextarea(textareaRef, 'Type message')}
              <Button type="button" onClick={handleSendMessage} className="self-end">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Preview: {newMessage.replace(/\n/g, ' ↵ ')}
            </div>
          </>
        )}

        {!selectedConversation && !showNewMessage && (
          <div className="space-y-2">
            {conversations.map(conv => (
              <div
                key={conv.phone_number}
                className="border p-3 rounded cursor-pointer hover:bg-muted"
                onClick={() => loadConversation(conv.phone_number)}
              >
                <p className="font-mono">{conv.phone_number}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(conv.last_activity), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Messages;
