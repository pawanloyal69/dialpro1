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
  const [newMessage, setNewMessage] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  const messageInputRef = useRef(null);
  const newMessageInputRef = useRef(null);

  const getContactNumber = useCallback(
    (from, to) => (myNumbers.includes(from) ? to : from),
    [myNumbers]
  );

  const loadMyNumbers = useCallback(async () => {
    try {
      const res = await api.get('/numbers/my');
      const nums = res.data.map(n => n.phone_number);
      setMyNumbers(nums);
      if (nums.length > 0 && !selectedNumber) {
        setSelectedNumber(nums[0]);
      }
    } catch (e) {
      console.error('Failed to load numbers', e);
    }
  }, [selectedNumber]);

  const loadConversations = useCallback(async () => {
    if (!selectedNumber) return;
    try {
      const res = await api.get('/messages/history?limit=100');
      const sortedMessages = res.data.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      const map = new Map();
      sortedMessages.forEach(msg => {
        const contact = getContactNumber(msg.from_number, msg.to_number);
        if (!map.has(contact)) {
          map.set(contact, {
            phone_number: contact,
            last_activity: msg.created_at
          });
        }
      });
      setConversations(
        Array.from(map.values()).sort(
          (a, b) => new Date(b.last_activity) - new Date(a.last_activity)
        )
      );
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  }, [selectedNumber, getContactNumber]);

  const loadConversation = useCallback(async (phoneNumber) => {
    try {
      const res = await api.get(`/messages/conversation/${phoneNumber}`);
      setMessages(res.data);
      setSelectedConversation(phoneNumber);
    } catch {
      toast.error('Failed to load conversation');
    }
  }, []);

  useEffect(() => {
    loadMyNumbers();
  }, [loadMyNumbers]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const getTextFromDiv = (div) => {
    if (!div) return '';
    return div.innerText; // innerText preserves newlines as \n
  };

  const handleMessageInput = (e) => {
    const text = getTextFromDiv(e.currentTarget);
    setNewMessage(text);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = useCallback(async () => {
    const toNumber = showNewMessage ? recipientNumber : selectedConversation;
    if (!selectedNumber || !toNumber || !newMessage.trim()) {
      toast.error('Please enter recipient and message');
      return;
    }

    console.log('🔍 SENDING RAW MESSAGE:', JSON.stringify(newMessage));
    console.log('📊 Does it contain \\n?', newMessage.includes('\n') ? '✅ YES' : '❌ NO');

    try {
      await api.post('/messages/send', {
        from_number: selectedNumber,
        to_number: toNumber,
        body: newMessage
      });
      toast.success('Message sent');
      setNewMessage('');
      setRecipientNumber('');
      setShowNewMessage(false);
      if (messageInputRef.current) messageInputRef.current.innerText = '';
      if (newMessageInputRef.current) newMessageInputRef.current.innerText = '';
      if (selectedConversation) {
        loadConversation(selectedConversation);
      } else {
        loadConversations();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send message');
    }
  }, [selectedNumber, selectedConversation, newMessage, recipientNumber, showNewMessage, loadConversation, loadConversations]);

  const renderMessageEditor = (ref, placeholder) => (
    <div
      ref={ref}
      contentEditable
      onInput={handleMessageInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className="flex-1 min-h-[60px] rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical whitespace-pre-wrap overflow-y-auto"
      style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
      data-placeholder={placeholder}
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
              {renderMessageEditor(newMessageInputRef, 'Message')}
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
              {renderMessageEditor(messageInputRef, 'Type message')}
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
