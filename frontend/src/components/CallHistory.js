import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Voicemail } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { format } from 'date-fns';
import { useWebSocket } from '../api/WebSocketContext';

const CallHistory = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { messages } = useWebSocket();

  useEffect(() => {
    loadCallHistory();
  }, []);

  // Auto-refresh call history when call ends
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.type === 'call_ended') {
      console.log('Call ended - refreshing call history');
      loadCallHistory();
    }
  }, [messages]);

  const loadCallHistory = async () => {
    try {
      const response = await api.get('/calls/history');
      // Sort by started_at in descending order (newest first)
      const sortedCalls = response.data.sort((a, b) => {
        return new Date(b.started_at) - new Date(a.started_at);
      });
      setCalls(sortedCalls);
    } catch (error) {
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const getCallIcon = (call) => {
    if (call.status === 'missed') return <PhoneMissed className="w-4 h-4 text-red-500" />;
    if (call.direction === 'inbound') return <PhoneIncoming className="w-4 h-4 text-green-500" />;
    return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
  };

  const formatDuration = (minutes) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="call-history-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Call History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No calls yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 conversation-item cursor-pointer"
                data-testid={`call-item-${call.id}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getCallIcon(call)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate font-mono">
                      {call.direction === 'outbound' ? call.to_number : call.from_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(call.started_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">
                      {call.duration > 0 ? formatDuration(call.duration) : 'No answer'}
                    </p>
                    {call.cost > 0 && (
                      <p className="text-xs text-gray-500">${call.cost.toFixed(4)}</p>
                    )}
                  </div>
                  {call.voicemail_url && (
                    <Voicemail className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallHistory;