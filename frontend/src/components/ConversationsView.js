import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { format } from 'date-fns';

const ConversationsView = () => {
  /* ================= STATE ================= */
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [calls, setCalls] = useState([]);
  const [voicemails, setVoicemails] = useState([]);
  const [myNumbers, setMyNumbers] = useState([]);
  const [selectedFromNumber, setSelectedFromNumber] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showNewSMS, setShowNewSMS] = useState(false);
  const [newSMSTo, setNewSMSTo] = useState('');
  const [newSMSBody, setNewSMSBody] = useState('');
  const [activeTab, setActiveTab] = useState('calls');
  const [smsView, setSmsView] = useState('list');
  const messagesEndRef = useRef(null);

  /* ================= HELPERS ================= */
  const getContactNumber = useCallback(
    (from, to) => {
      const mySet = new Set(myNumbers.map(n => n.phone_number));
      return mySet.has(from) ? to : from;
    },
    [myNumbers]
  );

  /* ================= LOAD NUMBERS ================= */
  const loadMyNumbers = useCallback(async () => {
    try {
      const res = await api.get('/numbers/my');
      setMyNumbers(res.data);
      if (res.data.length > 0) {
        setSelectedFromNumber(res.data[0].phone_number);
      }
    } catch (e) {
      console.error('Failed to load numbers', e);
    }
  }, []);

  /* ================= LOAD VOICEMAILS ================= */
  const loadVoicemails = useCallback(async () => {
    try {
      const res = await api.get('/voicemails');
      setVoicemails(res.data);
    } catch (e) {
      console.error('Failed to load voicemails', e);
    }
  }, []);

  /* ================= LOAD CONVERSATIONS ================= */
  const loadConversations = useCallback(async () => {
    try {
      const callsRes = await api.get('/calls/history?limit=100');
      
      // Sort calls by started_at descending (newest first)
      const sortedCalls = callsRes.data.sort((a, b) => 
        new Date(b.started_at) - new Date(a.started_at)
      );
      
      const map = new Map();

      sortedCalls.forEach(call => {
        const contact = getContactNumber(call.from_number, call.to_number);
        if (!map.has(contact)) {
          map.set(contact, {
            phone_number: contact,
            last_activity: call.started_at
          });
        }
      });

      setConversations(
        Array.from(map.values()).sort(
          (a, b) => new Date(b.last_activity) - new Date(a.last_activity)
        )
      );

      setCalls(sortedCalls);
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  }, [getContactNumber]);

  /* ================= LOAD CHAT DETAILS ================= */
  const loadConversationDetails = useCallback(
    async (contact) => {
      try {
        const [msgsRes, callsRes] = await Promise.all([
          api.get(`/messages/conversation/${contact}`),
          api.get('/calls/history?limit=100')
        ]);

        setMessages(msgsRes.data);

        setCalls(
          callsRes.data.filter(
            c => getContactNumber(c.from_number, c.to_number) === contact
          )
        );
      } catch (e) {
        console.error('Failed to load conversation details', e);
      }
    },
    [getContactNumber]
  );

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadMyNumbers();
    loadVoicemails();
  }, [loadMyNumbers, loadVoicemails]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedContact) {
      loadConversationDetails(selectedContact);
    }
  }, [selectedContact, loadConversationDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ================= ACTIONS ================= */
  const handleSendMessage = async () => {
    if (!newMessage || !selectedContact) return;

    await api.post('/messages/send', {
      from_number: selectedFromNumber,
      to_number: selectedContact,
      body: newMessage
    });

    setNewMessage('');
    loadConversationDetails(selectedContact);
  };

  const handleNewSMS = async () => {
    await api.post('/messages/send', {
      from_number: selectedFromNumber,
      to_number: newSMSTo,
      body: newSMSBody
    });

    setShowNewSMS(false);
    setNewSMSTo('');
    setNewSMSBody('');
    setSelectedContact(newSMSTo);
    setSmsView('chat');
    loadConversations();
  };

  const getCallIcon = (call) => {
    if (call.status === 'missed') return <PhoneMissed className="w-4 h-4 text-red-500" />;
    if (call.direction === 'inbound') return <PhoneIncoming className="w-4 h-4 text-green-500" />;
    return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
  };

  /* ================= UI ================= */
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 py-3">
        <CardTitle>Inbox</CardTitle>
      </CardHeader>

      <div className="flex-shrink-0 px-4">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={() => setActiveTab('calls')}
            className={`p-2 rounded ${activeTab === 'calls' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            data-testid="tab-calls"
          >
            Calls
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`p-2 rounded ${activeTab === 'sms' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            data-testid="tab-sms"
          >
            SMS
          </button>
          <button
            onClick={() => setActiveTab('voicemails')}
            className={`p-2 rounded ${activeTab === 'voicemails' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            data-testid="tab-voicemails"
          >
            Voicemails
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4" data-testid="conversations-scroll-area">
        {/* CALLS TAB */}
        {activeTab === 'calls' && (
          <div>
            {calls.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <p>No call history yet</p>
              </div>
            ) : (
              calls.map(call => (
                <div key={call.id} className="p-3 border-b flex gap-2">
                  {getCallIcon(call)}
                  <div>
                    <p className="font-mono">
                      {getContactNumber(call.from_number, call.to_number)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(call.started_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SMS TAB */}
        {activeTab === 'sms' && (
          <div>
            <div className="p-2 border-b flex justify-between mb-2">
              <span>Messages</span>
              <Button size="sm" onClick={() => setShowNewSMS(true)}>
                <Plus className="w-4 h-4 mr-1" /> New SMS
              </Button>
            </div>

            {smsView === 'list' && (
              <div>
                {conversations.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>No messages yet</p>
                  </div>
                ) : (
                  conversations.map(c => (
                    <div
                      key={c.phone_number}
                      className="p-3 border-b cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedContact(c.phone_number);
                        setSmsView('chat');
                      }}
                    >
                      {c.phone_number}
                    </div>
                  ))
                )}
              </div>
            )}

            {smsView === 'chat' && (
              <div>
                <Button variant="ghost" onClick={() => setSmsView('list')} className="mb-2">
                  ← Back
                </Button>
                <div className="space-y-2 mb-4">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}>
                      <span className={`inline-block p-2 rounded max-w-[70%] ${m.direction === 'inbound' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                        {m.body}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2 border-t pt-2 sticky bottom-0 bg-white">
                  <Input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type a message..."
                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>Send</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VOICEMAILS TAB */}
        {activeTab === 'voicemails' && (
          <div>
            {voicemails.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <p>No voicemails yet</p>
              </div>
            ) : (
              voicemails.map(vm => (
                <div key={vm.id} className="p-3 border-b">
                  <p className="font-mono font-medium">
                    {getContactNumber(vm.from_number, vm.to_number)}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {format(new Date(vm.created_at || new Date()), 'MMM d, h:mm a')}
                    {vm.duration > 0 && ` • ${Math.floor(vm.duration / 60)}:${(vm.duration % 60).toString().padStart(2, '0')}`}
                  </p>
                  <audio controls className="w-full mt-2">
                    <source
                      src={`${process.env.REACT_APP_BACKEND_URL}/api/voicemails/${vm.id}/audio`}
                    />
                  </audio>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* NEW SMS MODAL */}
      <Dialog open={showNewSMS} onOpenChange={setShowNewSMS}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New SMS</DialogTitle>
          </DialogHeader>
          <Input placeholder="To" value={newSMSTo} onChange={e => setNewSMSTo(e.target.value)} />
          <textarea
            className="w-full border rounded p-2"
            value={newSMSBody}
            onChange={e => setNewSMSBody(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleNewSMS}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ConversationsView;
