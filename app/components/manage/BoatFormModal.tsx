'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type Boat = {
  id?: string;
  name: string;
  type: 'sailboat' | 'motorboat';
  make: string;
  model: string;
  capacity: number | null;
  home_port: string;
  loa_m: number | null;
  beam_m: number | null;
  displcmt_m: number | null;
  link_to_specs: string;
};

type BoatFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  boatId?: string | null;
  userId: string;
};

export function BoatFormModal({ isOpen, onClose, onSuccess, boatId, userId }: BoatFormModalProps) {
  const [formData, setFormData] = useState<Boat>({
    name: '',
    type: 'sailboat',
    make: '',
    model: '',
    capacity: null,
    home_port: '',
    loa_m: null,
    beam_m: null,
    displcmt_m: null,
    link_to_specs: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingBoat, setIsLoadingBoat] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (isOpen && boatId) {
      loadBoat();
    } else if (isOpen && !boatId) {
      // Reset form for new boat
      setFormData({
        name: '',
        type: 'sailboat',
        make: '',
        model: '',
        capacity: null,
        home_port: '',
        loa_m: null,
        beam_m: null,
        displcmt_m: null,
        link_to_specs: '',
      });
      setImages([]);
      setError(null);
    }
  }, [isOpen, boatId]);

  const loadBoat = async () => {
    if (!boatId) return;
    
    setIsLoadingBoat(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('*')
      .eq('id', boatId)
      .single();

    if (fetchError) {
      setError('Failed to load boat details');
    } else if (data) {
      setFormData({
        name: data.name || '',
        type: data.type || 'sailboat',
        make: data.make || '',
        model: data.model || '',
        capacity: data.capacity || null,
        home_port: data.home_port || '',
        loa_m: data.loa_m || null,
        beam_m: data.beam_m || null,
        displcmt_m: data.displcmt_m || null,
        link_to_specs: data.link_to_specs || '',
      });
      setImages(data.images || []);
    }
    setIsLoadingBoat(false);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    const supabase = getSupabaseBrowserClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Please upload only image files');
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError('Image size must be less than 5MB');
          continue;
        }

        // Create unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('boat-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('boat-images')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(publicUrl);
      }

      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    const boatData = {
      name: formData.name,
      type: formData.type,
      make: formData.make || null,
      model: formData.model || null,
      capacity: formData.capacity || null,
      home_port: formData.home_port || null,
      loa_m: formData.loa_m || null,
      beam_m: formData.beam_m || null,
      displcmt_m: formData.displcmt_m || null,
      link_to_specs: formData.link_to_specs || null,
      images: images.length > 0 ? images : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (boatId) {
        // Update existing boat
        const { error: updateError } = await supabase
          .from('boats')
          .update(boatData)
          .eq('id', boatId)
          .eq('owner_id', userId);

        if (updateError) throw updateError;
      } else {
        // Create new boat
        const { error: insertError } = await supabase
          .from('boats')
          .insert({
            ...boatData,
            owner_id: userId,
          });

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save boat');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' || name === 'loa_m' || name === 'beam_m' || name === 'displcmt_m'
        ? value === '' ? null : Number(value)
        : value,
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
          className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-card-foreground">
                {boatId ? 'Edit Boat' : 'Add New Boat'}
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingBoat ? (
              <div className="text-center py-8">Loading boat details...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Boat Name */}
                  <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                      Boat Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Sea Breeze"
                    />
                  </div>

                  {/* Boat Type */}
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-foreground mb-1">
                      Boat Type *
                    </label>
                    <select
                      id="type"
                      name="type"
                      required
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    >
                      <option value="sailboat">Sailboat</option>
                      <option value="motorboat">Motorboat</option>
                    </select>
                  </div>

                  {/* Capacity */}
                  <div>
                    <label htmlFor="capacity" className="block text-sm font-medium text-foreground mb-1">
                      Capacity (people)
                    </label>
                    <input
                      type="number"
                      id="capacity"
                      name="capacity"
                      min="1"
                      value={formData.capacity || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 6"
                    />
                  </div>

                  {/* Make */}
                  <div>
                    <label htmlFor="make" className="block text-sm font-medium text-foreground mb-1">
                      Make
                    </label>
                    <input
                      type="text"
                      id="make"
                      name="make"
                      value={formData.make}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Beneteau"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label htmlFor="model" className="block text-sm font-medium text-foreground mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      id="model"
                      name="model"
                      value={formData.model}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Oceanis 40"
                    />
                  </div>

                  {/* Home Port */}
                  <div>
                    <label htmlFor="home_port" className="block text-sm font-medium text-foreground mb-1">
                      Home Port
                    </label>
                    <input
                      type="text"
                      id="home_port"
                      name="home_port"
                      value={formData.home_port}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Marina del Rey, CA"
                    />
                  </div>

                  {/* Length Overall (LOA) */}
                  <div>
                    <label htmlFor="loa_m" className="block text-sm font-medium text-foreground mb-1">
                      Length Overall (m)
                    </label>
                    <input
                      type="number"
                      id="loa_m"
                      name="loa_m"
                      step="0.1"
                      min="0"
                      value={formData.loa_m || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 12.5"
                    />
                  </div>

                  {/* Beam */}
                  <div>
                    <label htmlFor="beam_m" className="block text-sm font-medium text-foreground mb-1">
                      Beam (m)
                    </label>
                    <input
                      type="number"
                      id="beam_m"
                      name="beam_m"
                      step="0.1"
                      min="0"
                      value={formData.beam_m || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 4.2"
                    />
                  </div>

                  {/* Displacement */}
                  <div>
                    <label htmlFor="displcmt_m" className="block text-sm font-medium text-foreground mb-1">
                      Displacement (kg)
                    </label>
                    <input
                      type="number"
                      id="displcmt_m"
                      name="displcmt_m"
                      step="0.1"
                      min="0"
                      value={formData.displcmt_m || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 8500"
                    />
                  </div>

                  {/* Link to Specs */}
                  <div className="md:col-span-2">
                    <label htmlFor="link_to_specs" className="block text-sm font-medium text-foreground mb-1">
                      Link to Specifications
                    </label>
                    <input
                      type="url"
                      id="link_to_specs"
                      name="link_to_specs"
                      value={formData.link_to_specs}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="https://sailboatdata.com/..."
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Boat Images
                    </label>
                    <div className="space-y-4">
                      {/* Upload Input */}
                      <div className="flex items-center gap-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg className="w-10 h-10 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="mb-2 text-sm text-muted-foreground">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleImageUpload(e.target.files)}
                            disabled={uploadingImages}
                          />
                        </label>
                      </div>

                      {/* Image Preview Grid */}
                      {images.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {images.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Boat image ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-border"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove image"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {uploadingImages && (
                        <p className="text-sm text-muted-foreground">Uploading images...</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {loading ? 'Saving...' : boatId ? 'Update Boat' : 'Create Boat'}
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
