'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type Journey = {
  id?: string;
  boat_id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  is_public: boolean;
};

type Boat = {
  id: string;
  name: string;
};

type JourneyFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  journeyId?: string | null;
  userId: string;
};

export function JourneyFormModal({ isOpen, onClose, onSuccess, journeyId, userId }: JourneyFormModalProps) {
  const [formData, setFormData] = useState<Journey>({
    boat_id: '',
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    is_public: true,
  });
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingJourney, setIsLoadingJourney] = useState(false);
  const [isLoadingBoats, setIsLoadingBoats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBoats();
      if (journeyId) {
        loadJourney();
      } else {
        // Reset form for new journey
        setFormData({
          boat_id: '',
          name: '',
          start_date: '',
          end_date: '',
          description: '',
          is_public: true,
        });
        setError(null);
      }
    }
  }, [isOpen, journeyId]);

  const loadBoats = async () => {
    setIsLoadingBoats(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', userId)
      .order('name', { ascending: true });

    if (fetchError) {
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
    setIsLoadingBoats(false);
  };

  const loadJourney = async () => {
    if (!journeyId) return;
    
    setIsLoadingJourney(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', journeyId)
      .single();

    if (fetchError) {
      setError('Failed to load journey details');
    } else if (data) {
      setFormData({
        boat_id: data.boat_id || '',
        name: data.name || '',
        start_date: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '',
        end_date: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '',
        description: data.description || '',
        is_public: data.is_public !== undefined ? data.is_public : true,
      });
    }
    setIsLoadingJourney(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    const journeyData = {
      boat_id: formData.boat_id,
      name: formData.name,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description || null,
      is_public: formData.is_public,
      updated_at: new Date().toISOString(),
    };

    try {
      if (journeyId) {
        // Update existing journey
        const { error: updateError } = await supabase
          .from('journeys')
          .update(journeyData)
          .eq('id', journeyId);

        if (updateError) throw updateError;
      } else {
        // Create new journey
        const { error: insertError } = await supabase
          .from('journeys')
          .insert(journeyData);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save journey');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {journeyId ? 'Edit Journey' : 'Create New Journey'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingJourney || isLoadingBoats ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Boat Selection */}
                  <div className="md:col-span-2">
                    <label htmlFor="boat_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Boat *
                    </label>
                    <select
                      id="boat_id"
                      name="boat_id"
                      required
                      value={formData.boat_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C4969] focus:border-[#2C4969]"
                    >
                      <option value="">Select a boat</option>
                      {boats.map((boat) => (
                        <option key={boat.id} value={boat.id}>
                          {boat.name}
                        </option>
                      ))}
                    </select>
                    {boats.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        You need to create a boat first before creating a journey.
                      </p>
                    )}
                  </div>

                  {/* Journey Name */}
                  <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Journey Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C4969] focus:border-[#2C4969]"
                      placeholder="e.g., Mediterranean Adventure 2024"
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C4969] focus:border-[#2C4969]"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C4969] focus:border-[#2C4969]"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C4969] focus:border-[#2C4969]"
                      placeholder="Describe your journey..."
                    />
                  </div>

                  {/* Is Public */}
                  <div className="md:col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_public"
                        checked={formData.is_public}
                        onChange={handleChange}
                        className="w-4 h-4 text-[#2C4969] border-gray-300 rounded focus:ring-[#2C4969]"
                      />
                      <span className="ml-2 text-sm text-gray-700">Make this journey public</span>
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-4 border-t mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || boats.length === 0}
                    className="px-4 py-2 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#2C4969' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#1F3449')}
                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#2C4969')}
                  >
                    {loading ? 'Saving...' : journeyId ? 'Update Journey' : 'Create Journey'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
