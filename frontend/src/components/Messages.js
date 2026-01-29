import React, { useState, useEffect, useCallback } from 'react';
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

  // ✅ Helper: always return the external number
  const getContactNumber = useCallback(
    (from, to) => (myNumbers.includes(from) ? to : from),
    [myNumbers]
  );

  // ✅ Load user's numbers
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

  // ✅ Load conversation list (external numbers only)
  const loadConversations = useCallback(async () => {
    if (!selectedNumber) return;

    try {
      const res = await api.get('/messages/history?limit=100');
      const map = new Map();

      res.data.forEach(msg => {
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

  // ✅ Load messages for one conversation
  const loadConversation = useCallback(async (phoneNumber) => {
    try {
      const res = await api.get(`/messages/conversation/${phoneNumber}`);
      setMessages(res.data);
      setSelectedConversation(phoneNumber);
    } catch {
      toast.error('Failed to load conversation');
    }
  }, []);

  // ---- EFFECTS (ORDER MATTERS) ----
  useEffect(() => {
    loadMyNumbers();
  }, [loadMyNumbers]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---- SEND MESSAGE ----
  const handleSendMessage = async (e) => {
    e.preventDefault();

    const toNumber = showNewMessage ? recipientNumber : selectedConversation;

    if (!selectedNumber || !toNumber || !newMessage.trim()) {
      toast.error('Please enter recipient and message');
      return;
    }

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

      if (selectedConversation) {
        loadConversation(selectedConversation);
      } else {
        loadConversations();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send message');
    }
  };

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
        {/* FROM NUMBER */}
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

        {/* NEW MESSAGE */}
        {showNewMessage && (
          <form onSubmit={handleSendMessage} className="space-y-2">
            <Input
              placeholder="Recipient number"
              value={recipientNumber}
              onChange={e => setRecipientNumber(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Message"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <Button type="submit">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* CHAT VIEW */}
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
                  <div className={`p-2 rounded ${msg.direction === 'outbound' ? 'bg-primary text-white' : 'bg-muted'}`}>
                    <p>{msg.body}</p>
                    <p className="text-xs opacity-70">
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                placeholder="Type message"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <Button type="submit">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}

        {/* CONVERSATION LIST */}
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
