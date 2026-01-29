import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Crown, ChevronDown, ChevronUp, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { format } from 'date-fns';

const PlansSection = () => {
  const [countries, setCountries] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [activePlans, setActivePlans] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showActivePlans, setShowActivePlans] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [countriesRes, pricingRes, plansRes] = await Promise.all([
        api.get('/countries'),
        api.get('/pricing'),
        api.get('/plans/active')
      ]);
      setCountries(countriesRes.data);
      setPricing(pricingRes.data);
      setActivePlans(plansRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const getPricingForCountry = (countryCode) => {
    return pricing.find(p => p.country_code === countryCode);
  };

  const getCountryInfo = (countryCode) => {
    return countries.find(c => c.code === countryCode);
  };

  const hasActivePlanForCountry = (countryCode) => {
    return activePlans.some(p => p.country_code === countryCode);
  };

  const handlePurchasePlan = async () => {
    if (!selectedCountry) {
      toast.error('Please select a country');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/plans/purchase', { country_code: selectedCountry });
      toast.success(response.data.message);
      setShowBuyDialog(false);
      setSelectedCountry('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to purchase plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="plans-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="w-5 h-5 text-yellow-500" />
            Calling Plans
          </CardTitle>
          <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="buy-plan-button">
                Buy Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Buy Unlimited Calling Plan</DialogTitle>
                <DialogDescription>
                  Get unlimited calls for 30 days (2000 min FUP)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Country</label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger data-testid="plan-country-select" className="w-full">
                      <SelectValue placeholder="Choose a country" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} className="z-[9999] max-h-[300px]">
                      {countries.length === 0 ? (
                        <SelectItem value="loading" disabled>Loading countries...</SelectItem>
                      ) : (
                        countries.map((country) => {
                          const hasActive = hasActivePlanForCountry(country.code);
                          return (
                            <SelectItem 
                              key={country.id} 
                              value={country.code}
                              disabled={hasActive}
                            >
                              {country.flag} {country.name} 
                              {hasActive && ' (Active)'}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCountry && (
                  <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {getCountryInfo(selectedCountry)?.flag} {getCountryInfo(selectedCountry)?.name}
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        ${getPricingForCountry(selectedCountry)?.unlimited_call_plan_monthly}/mo
                      </span>
                    </div>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Unlimited outbound calls
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        2000 minutes FUP
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Valid for 30 days
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        SMS charged separately
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBuyDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handlePurchasePlan} 
                  disabled={loading || !selectedCountry}
                  data-testid="confirm-buy-plan"
                >
                  {loading ? 'Processing...' : 'Purchase Plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Active Plans Collapsible */}
        <Collapsible open={showActivePlans} onOpenChange={setShowActivePlans}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-8 px-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                My Active Plans ({activePlans.length})
              </span>
              {showActivePlans ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {activePlans.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-3">
                No active plans. Buy one to get unlimited calls!
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {activePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-3 border rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10"
                    data-testid={`active-plan-${plan.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {plan.country_flag} {plan.country_name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      <p>Minutes used: {plan.minutes_used.toFixed(0)} / {plan.minutes_limit}</p>
                      <p>Expires: {format(new Date(plan.expires_at), 'MMM d, yyyy')}</p>
                    </div>
                    {/* Usage bar */}
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                        style={{ width: `${Math.min((plan.minutes_used / plan.minutes_limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default PlansSection;
