import React, { useState, useEffect, useCallback, useRef } from 'react';
// Twilio Device is loaded from CDN (window.Twilio.Device)
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Phone, PhoneOff, Mic, MicOff, Delete, Pause, Play,
  Grid3X3, PhoneForwarded, UserPlus, GitMerge, PhoneIncoming,
  Volume2, VolumeX, AlertCircle, Speaker
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { useWebSocket } from '../api/WebSocketContext';
import { useAuth } from '../api/AuthContext';

// Get Twilio Device from global (loaded via CDN in index.html)
const getTwilioDevice = () => {
  if (window.Twilio && window.Twilio.Device) {
    return window.Twilio.Device;
  }
  return null;
};

const Dialer = () => {
  const { user, micPermission: authMicPermission } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [myNumbers, setMyNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAddCall, setShowAddCall] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [addCallNumber, setAddCallNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState('disconnected');
  // Use mic permission from AuthContext (persisted in localStorage)
  const [micPermission, setMicPermission] = useState(authMicPermission || localStorage.getItem('mic_permission') || 'unknown');
  const { messages } = useWebSocket();
  
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const durationInterval = useRef(null);
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  // Initialize Twilio Device (v2 SDK)
  const initializeTwilioDevice = useCallback(async () => {
    if (deviceRef.current) {
      console.log('Twilio Device already initialized');
      return;
    }

    const TwilioDevice = getTwilioDevice();
    if (!TwilioDevice) {
      console.error('Twilio SDK not loaded from CDN');
      setDeviceStatus('error');
      return;
    }
    
    try {
      // Get access token from backend
      const response = await api.get('/voice/token');
      const { token, identity } = response.data;
      
      console.log('Initializing Twilio Device v2 with identity:', identity);
      
      // Create Twilio Device using v2 SDK
      const device = new TwilioDevice(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
        edge: 'ashburn',
        enableRingingState: true,   // 🔥 REQUIRED
        closeProtection: true       // (debug safety)
      })

      deviceRef.current = device;
      
      // Device event handlers for v2 SDK
      device.on('registered', () => {
        console.log('Twilio Device registered');
        setDeviceStatus('ready');
        toast.success('Phone ready for calls');
      });
      
      device.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        setDeviceStatus('disconnected');
      });
      
      device.on('error', (error) => {
        console.error('Twilio Device error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message
        });
        setDeviceStatus('error');
        if (error.message && error.code !== 31205) { // Ignore token expiry warnings
          toast.error(`Phone error: ${error.message}`);
        }
      });
      
      device.on('tokenWillExpire', async () => {
        console.log('Token will expire, refreshing...');
        try {
          const response = await api.get('/voice/token');
          device.updateToken(response.data.token);
          console.log('Token refreshed');
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
      });
      
      // Handle incoming calls
      device.on('incoming', (call) => {
        console.log('Incoming call from:', call.parameters.From);
        setIncomingCall({
          call: call,
          from: call.parameters.From,
          to: call.parameters.To
        });
        
        // Call event handlers
        call.on('accept', () => {
          console.log('Call accepted');
          setActiveCall({
            call: call,
            from_number: call.parameters.From,
            to_number: call.parameters.To,
            direction: 'inbound',
            status: 'in-progress'
          });
          setIncomingCall(null);
        });
        
        call.on('disconnect', () => {
          console.log('Call disconnected');
          handleCallEnded();
        });
        
        call.on('cancel', () => {
          console.log('Call cancelled');
          setIncomingCall(null);
          toast.info('Incoming call cancelled');
        });
        
        call.on('reject', () => {
          console.log('Call rejected');
          setIncomingCall(null);
        });
      });
      
      // Register the device
      device.register();
      console.log('Twilio register() called');
      deviceRef.current = device;
      
    } catch (error) {
      console.error('Failed to initialize Twilio Device:', error);
      const status = error.response?.status;
      const detail = error.response?.data?.detail || '';
      
      if (status === 500 || detail.includes('not configured') || detail.includes('credentials')) {
        // Twilio not configured - don't show error toast repeatedly
        console.log('Voice calling not configured on server');
        setDeviceStatus('not-configured');
      } else if (status === 401) {
        // User not authenticated
        setDeviceStatus('disconnected');
      } else if (status >= 500 || error.code === 'ERR_NETWORK') {
        // Server error or network issue - likely not configured
        console.log('Server error - voice may not be configured');
        setDeviceStatus('not-configured');
      } else {
        // Only show toast for unexpected errors
        console.error('Unexpected error:', error);
        setDeviceStatus('error');
      }
    }
  }, []);

  // ✅ Auto-register Twilio Device once user is logged in
useEffect(() => {
  if (!user) return;

  if (deviceRef.current) {
    return; // already registered
  }

  console.log('Auto-initializing Twilio Device on login');
  initializeTwilioDevice();
}, [user, initializeTwilioDevice]);


  // Request microphone permission (only if not already granted)
  const requestMicPermission = useCallback(async () => {
    // Check localStorage first
    const storedPermission = localStorage.getItem('mic_permission');
    if (storedPermission === 'granted') {
      setMicPermission('granted');
      return true;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream after permission
      setMicPermission('granted');
      localStorage.setItem('mic_permission', 'granted');
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermission('denied');
      localStorage.setItem('mic_permission', 'denied');
      toast.error('Microphone access is required for voice calls');
      return false;
    }
  }, []);

  // Check mic permission on mount (read from localStorage, don't prompt)
  useEffect(() => {
    const storedPermission = localStorage.getItem('mic_permission');
    if (storedPermission) {
      setMicPermission(storedPermission);
    } else {
      // Check browser permission status without prompting
      navigator.permissions?.query({ name: 'microphone' })
        .then((result) => {
          setMicPermission(result.state);
          if (result.state === 'granted') {
            localStorage.setItem('mic_permission', 'granted');
          }
        })
        .catch(() => {
          // Permissions API not supported
          setMicPermission('unknown');
        });
    }

    // Detect if device is mobile
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || isTouchDevice);
    };
    checkMobile();
  }, []);

  const loadMyNumbers = useCallback(async () => {
    try {
      const response = await api.get('/numbers/my');
      setMyNumbers(response.data);
      if (response.data.length > 0 && !selectedNumber) {
        setSelectedNumber(response.data[0].phone_number);
      }
    } catch (error) {
      console.error('Failed to load numbers:', error);
    }
  }, [selectedNumber]);

  useEffect(() => {
    loadMyNumbers();
  }, [loadMyNumbers]);

  // Call duration timer
  useEffect(() => {
    if (activeCall) {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    }
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [activeCall]);

  // Handle WebSocket messages for call events
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.type === 'call_ended') {
      handleCallEnded();
    } else if (lastMessage?.type === 'incoming_call') {
      // Already handled by Twilio Device
      console.log('Incoming call notification:', lastMessage);
    }
  }, [messages]);

  const handleCallEnded = () => {
    setActiveCall(null);
    setIsMuted(false);
    setIsOnHold(false);
    setIsSpeakerOn(false);
    setShowKeypad(false);
    callRef.current = null;
    toast.info('Call ended');
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeCall) {
        if (/^[0-9*#]$/.test(e.key)) {
          handleDTMF(e.key);
        }
        return;
      }
      
      if (/^[0-9*#]$/.test(e.key)) {
        setPhoneNumber(prev => prev + e.key);
      } else if (e.key === '+') {
        setPhoneNumber(prev => prev + '+');
      } else if (e.key === 'Backspace') {
        setPhoneNumber(prev => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCall]);

  const handleDigitClick = (digit) => {
    if (activeCall) {
      handleDTMF(digit);
    } else if (!isLongPress) {
      setPhoneNumber(prev => prev + digit);
    }
    setIsLongPress(false);
  };

  const handleDigitMouseDown = (digit) => {
    if (digit === '0' && !activeCall) {
      longPressTimer.current = setTimeout(() => {
        setIsLongPress(true);
        setPhoneNumber(prev => prev + '+');
      }, 500);
    }
  };

  const handleDigitMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDTMF = (digit) => {
    if (callRef.current) {
      callRef.current.sendDigits(digit);
      toast.info(`DTMF: ${digit}`);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9+*#]/g, '');
    setPhoneNumber(value);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const filteredText = pastedText.replace(/[^0-9+*#]/g, '');
    setPhoneNumber(prev => prev + filteredText);
  };

  const handleCall = async () => {
    console.log('Call button clicked');
    if (!selectedNumber) {
      toast.error('Please purchase a virtual number first');
      return;
    }

    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

  

// Resume AudioContext explicitly (Chrome requirement)
try {
  let ctx = null;

  if (window.AudioContext) {
    ctx = new window.AudioContext();
  } else if (window.webkitAudioContext) {
    ctx = new window.webkitAudioContext();
  }

  if (ctx && ctx.state === 'suspended') {
    await ctx.resume();
  }
} catch (e) {
  console.warn('AudioContext resume failed', e);
}


if (deviceStatus !== 'ready') {
  toast.error('Phone is still connecting. Try again in 1 second.');
  return;
}


    // Request mic permission if not granted
    if (micPermission !== 'granted') {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    try {
      // First validate the call with backend
      const validateResponse = await api.post('/calls/initiate', {
        to_number: phoneNumber,
        from_number: selectedNumber
      });
      
      console.log('Call validated:', validateResponse.data);
      
      // Connect call via Twilio Device
      const call = await deviceRef.current.connect({
  params: {
    To: phoneNumber,          // MUST be exactly "To"
  }
});

// 🔥 register SID as soon as it exists
call.on('accept', async () => {
  const callSid = call.parameters.CallSid;
  if (callSid) {
    await api.post('/calls/update-sid', {
      call_sid: callSid,
      call_id: validateResponse.data.call_id
    });
  }

  setActiveCall({
    call,
    to_number: phoneNumber,
    from_number: selectedNumber,
    direction: 'outbound',
    status: 'in-progress',
    call_id: validateResponse.data.call_id
  });
});



      call.on('ringing', async () => {
  const callSid = call.parameters.CallSid;

  if (callSid) {
    await api.post('/calls/update-sid', {
  call_sid: callSid,
  call_id: validateResponse.data.call_id
});
  }
});



      
      callRef.current = call;
      
      // Set up call event handlers
      call.on('accept', () => {
        console.log('Outbound call connected');
        setActiveCall({
          call: call,
          to_number: phoneNumber,
          from_number: selectedNumber,
          direction: 'outbound',
          status: 'in-progress',
          call_id: validateResponse.data.call_id
        });
      });
      
      call.on('ringing', () => {
        console.log('Call ringing...');
        toast.info('Ringing...');
      });
      
      call.on('disconnect', () => {
        console.log('Call disconnected');
        handleCallEnded();
      });
      
      call.on('cancel', () => {
        console.log('Call cancelled');
        handleCallEnded();
      });
      
      call.on('error', (error) => {
        console.error('Call error:', error);
        toast.error(`Call error: ${error.message}`);
        handleCallEnded();
      });
      
      toast.success('Connecting call...');
      
    } catch (error) {
      console.error('Failed to initiate call:', error);
      toast.error(error.response?.data?.detail || 'Failed to initiate call');
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall?.call) {
      incomingCall.call.accept();
    }
  };

  const handleRejectCall = () => {
    if (incomingCall?.call) {
      incomingCall.call.reject();
      setIncomingCall(null);
    }
  };

  const handleEndCall = async () => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
    
    try {
      await api.post('/calls/end');
    } catch (error) {
      console.error('Failed to end call on server:', error);
    }
    
    handleCallEnded();
  };

  const handleToggleMute = () => {
    if (callRef.current) {
      const newMuteState = !isMuted;
      callRef.current.mute(newMuteState);
      setIsMuted(newMuteState);
      toast.info(newMuteState ? 'Muted' : 'Unmuted');
    }
  };

  const handleToggleHold = () => {
    // Note: Hold functionality requires Twilio Conference or additional setup
    setIsOnHold(!isOnHold);
    toast.info(isOnHold ? 'Call Resumed' : 'Call On Hold');
  };

  const handleToggleSpeaker = async () => {
    try {
      if (!callRef.current) return;
      
      const newSpeakerState = !isSpeakerOn;
      
      // Get the audio element from Twilio Device
      const audioElement = document.querySelector('audio');
      
      if (audioElement && audioElement.setSinkId) {
        // Use setSinkId to switch between speaker and earpiece
        // Empty string '' = default device (earpiece on mobile)
        // 'default' = default output device (speaker on mobile)
        await audioElement.setSinkId(newSpeakerState ? 'default' : '');
        setIsSpeakerOn(newSpeakerState);
        toast.info(newSpeakerState ? 'Speaker On' : 'Earpiece On');
      } else {
        // Fallback: Just toggle the state and show message
        setIsSpeakerOn(newSpeakerState);
        toast.info(newSpeakerState ? 'Speaker Mode' : 'Earpiece Mode');
      }
    } catch (error) {
      console.error('Failed to toggle speaker:', error);
      // Still toggle state even if setSinkId fails
      setIsSpeakerOn(!isSpeakerOn);
      toast.info(isSpeakerOn ? 'Earpiece Mode' : 'Speaker Mode');
    }
  };

  const handleTransfer = () => {
    if (!transferNumber) {
      toast.error('Enter transfer number');
      return;
    }
    toast.success(`Transferring to ${transferNumber}...`);
    setShowTransfer(false);
    setTransferNumber('');
  };

  const handleAddCall = () => {
    if (!addCallNumber) {
      toast.error('Enter number to add');
      return;
    }
    toast.success(`Adding ${addCallNumber} to call...`);
    setShowAddCall(false);
    setAddCallNumber('');
  };

  const handleMerge = () => {
    toast.success('Merging calls...');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <>
      {/* Incoming Call Modal */}
      <Dialog open={!!incomingCall} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneIncoming className="w-6 h-6 text-green-500 animate-pulse" />
              Incoming Call
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-2xl font-mono font-bold mb-2">{incomingCall?.from}</p>
            <p className="text-gray-500">Calling your number {incomingCall?.to}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              onClick={handleRejectCall}
              data-testid="reject-incoming-call"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={handleAnswerCall}
              data-testid="answer-incoming-call"
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-card" data-testid="dialer-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5" />
            Dialer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Mic Permission Warning - only show if explicitly denied */}
          {micPermission === 'denied' && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-red-800 dark:text-red-200">
                Microphone access denied. Please enable it in browser settings.
              </p>
            </div>
          )}

          {/* Number Selector */}
          {!activeCall && myNumbers.length > 0 ? (
            <div>
              <label className="text-xs font-medium mb-1 block text-gray-600">From</label>
              <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                <SelectTrigger data-testid="from-number-select" className="h-9">
                  <SelectValue placeholder="Select your number" />
                </SelectTrigger>
                <SelectContent>
                  {myNumbers.map((num) => (
                    <SelectItem key={num.id} value={num.phone_number}>
                      {num.phone_number} ({num.country_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : !activeCall && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs">
              <p className="text-amber-800 dark:text-amber-200">
                No virtual numbers yet. Purchase one to start calling!
              </p>
            </div>
          )}

          {/* Phone Number Input / Active Call Display */}
          {activeCall ? (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                {activeCall.direction === 'inbound' ? 'Incoming Call' : 'Call In Progress'}
              </p>
              <p className="text-2xl font-mono font-bold">
                {activeCall.direction === 'inbound' ? activeCall.from_number : activeCall.to_number}
              </p>
              <p className="text-lg font-mono text-green-600">{formatDuration(callDuration)}</p>
              {isOnHold && (
                <p className="text-sm text-orange-500 mt-1">⏸ On Hold</p>
              )}
              {isMuted && (
                <p className="text-sm text-red-500 mt-1">🔇 Muted</p>
              )}
            </div>
          ) : (
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                value={phoneNumber}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder="Enter or paste number"
                className="text-2xl font-mono text-center h-14 pr-10"
                data-testid="dialer-display"
              />
              {phoneNumber && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleBackspace}
                >
                  <Delete className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {/* Active Call Controls */}
          {activeCall && (
            <div className="space-y-3">
              {/* Primary Controls */}
              <div className={`grid ${isMobile ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}>
                <Button
                  variant={isMuted ? 'destructive' : 'outline'}
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={handleToggleMute}
                  data-testid="mute-button"
                >
                  {isMuted ? <MicOff className="w-5 h-5 mb-1" /> : <Mic className="w-5 h-5 mb-1" />}
                  <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
                </Button>
                
                <Button
                  variant={isOnHold ? 'default' : 'outline'}
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={handleToggleHold}
                  data-testid="hold-button"
                >
                  {isOnHold ? <Play className="w-5 h-5 mb-1" /> : <Pause className="w-5 h-5 mb-1" />}
                  <span className="text-xs">{isOnHold ? 'Resume' : 'Hold'}</span>
                </Button>
                
                <Button
                  variant={showKeypad ? 'default' : 'outline'}
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={() => setShowKeypad(!showKeypad)}
                  data-testid="keypad-button"
                >
                  <Grid3X3 className="w-5 h-5 mb-1" />
                  <span className="text-xs">Keypad</span>
                </Button>
                
                {isMobile && (
                  <Button
                    variant={isSpeakerOn ? 'default' : 'outline'}
                    className="flex flex-col items-center py-3 h-auto"
                    onClick={handleToggleSpeaker}
                    data-testid="speaker-button"
                  >
                    {isSpeakerOn ? <Volume2 className="w-5 h-5 mb-1" /> : <Speaker className="w-5 h-5 mb-1" />}
                    <span className="text-xs">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={() => setShowAddCall(true)}
                  data-testid="add-call-button"
                >
                  <UserPlus className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add</span>
                </Button>
              </div>

              {/* Secondary Controls */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={() => setShowTransfer(true)}
                  data-testid="transfer-button"
                >
                  <PhoneForwarded className="w-5 h-5 mb-1" />
                  <span className="text-xs">Transfer</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={handleMerge}
                  data-testid="merge-button"
                >
                  <GitMerge className="w-5 h-5 mb-1" />
                  <span className="text-xs">Merge</span>
                </Button>
                
                <Button
                  variant="destructive"
                  className="flex flex-col items-center py-3 h-auto"
                  onClick={handleEndCall}
                  data-testid="end-call-button"
                >
                  <PhoneOff className="w-5 h-5 mb-1" />
                  <span className="text-xs">End</span>
                </Button>
              </div>

              {/* DTMF Keypad */}
              {showKeypad && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  {digits.map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      className="h-12 text-xl font-medium"
                      onClick={() => handleDTMF(digit)}
                    >
                      {digit}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dial Pad (when not on call) */}
          {!activeCall && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {digits.map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-12 w-full text-xl font-medium dial-pad-button rounded-full relative"
                    onClick={() => handleDigitClick(digit)}
                    onMouseDown={() => handleDigitMouseDown(digit)}
                    onMouseUp={handleDigitMouseUp}
                    onMouseLeave={handleDigitMouseUp}
                    onTouchStart={() => handleDigitMouseDown(digit)}
                    onTouchEnd={handleDigitMouseUp}
                    data-testid={`dial-${digit}`}
                  >
                    {digit}
                    {digit === '0' && (
                      <span className="absolute bottom-0.5 text-[8px] text-gray-400">+</span>
                    )}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                onClick={handleCall}
                disabled={!phoneNumber || !selectedNumber}
                data-testid="call-button"
              >
                <Phone className="w-5 h-5 mr-2" />
                Call
              </Button>
            </>
          )}

          {/* Transfer Dialog */}
          <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Call</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Enter number to transfer"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowTransfer(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleTransfer}>
                    <PhoneForwarded className="w-4 h-4 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Call Dialog */}
          <Dialog open={showAddCall} onOpenChange={setShowAddCall}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Call</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Enter number to add"
                  value={addCallNumber}
                  onChange={(e) => setAddCallNumber(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddCall(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleAddCall}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add Call
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
};

export default Dialer;
