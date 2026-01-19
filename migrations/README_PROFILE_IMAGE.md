# Profile Image Migration Guide

This guide explains how to set up profile image functionality for both owners and crew members.

## 1. Database Migration

Run the SQL migration script to add the `profile_image_url` column to the `profiles` table:

```sql
-- File: migrations/add_profile_image_url_to_profiles.sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_image_url text;

COMMENT ON COLUMN public.profiles.profile_image_url IS 'URL to the user profile image stored in Supabase Storage (profile-images bucket)';
```

### How to Run the Migration

**Option 1: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL from `add_profile_image_url_to_profiles.sql`
4. Click "Run" to execute

**Option 2: Using Supabase CLI**
```bash
supabase db push
```

## 2. Storage Bucket Setup

You need to create a storage bucket named `profile-images` in Supabase Storage.

### Steps to Create the Bucket:

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on "Storage" in the left sidebar

2. **Create New Bucket**
   - Click "New bucket"
   - Name: `profile-images`
   - Public bucket: **Yes** (check this box)
   - Click "Create bucket"

3. **Set Up Storage Policies (RLS)**

   You need to create policies that allow users to:
   - Upload their own profile images
   - Read/view all profile images (since they're public)
   - Delete their own profile images

   **Policy 1: Allow authenticated users to upload their own images**
   ```sql
   CREATE POLICY "Users can upload their own profile images"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'profile-images' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

   **Policy 2: Allow public read access to profile images**
   ```sql
   CREATE POLICY "Public read access for profile images"
   ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'profile-images');
   ```

   **Policy 3: Allow users to delete their own profile images**
   ```sql
   CREATE POLICY "Users can delete their own profile images"
   ON storage.objects
   FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'profile-images' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

   **Policy 4: Allow users to update their own profile images**
   ```sql
   CREATE POLICY "Users can update their own profile images"
   ON storage.objects
   FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'profile-images' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

### Alternative: Simplified Policies (if you prefer)

If you want a simpler setup, you can use these policies:

```sql
-- Allow authenticated users full access to their own folder
CREATE POLICY "Users manage their own profile images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access
CREATE POLICY "Public read access for profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');
```

## 3. File Structure

The storage bucket will organize files as follows:
```
profile-images/
  └── {user_id}/
      └── {timestamp}-{random}.{ext}
```

Example:
```
profile-images/
  └── 123e4567-e89b-12d3-a456-426614174000/
      └── 1704067200000-abc123.jpg
```

## 4. Verification

After setting up:

1. **Verify the database column exists:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'profile_image_url';
   ```

2. **Verify the storage bucket exists:**
   - Go to Storage in Supabase Dashboard
   - Confirm `profile-images` bucket is visible and marked as public

3. **Test the functionality:**
   - Log in to your application
   - Go to Profile page (`/profile`)
   - Try uploading a profile image
   - Verify the image appears and can be removed

## 5. Troubleshooting

### Issue: "Failed to upload image"
- Check that the `profile-images` bucket exists
- Verify the bucket is set to public
- Check that storage policies are correctly set up
- Ensure the user is authenticated

### Issue: "Failed to delete image"
- Verify the DELETE policy is set up correctly
- Check that the user owns the image (path contains their user ID)

### Issue: Image not displaying
- Verify the bucket is public
- Check that the SELECT policy allows public read access
- Verify the URL format is correct

## Notes

- Maximum file size: 5MB (enforced in the application code)
- Supported formats: PNG, JPG, GIF, and other image formats
- Old images are automatically deleted when a new image is uploaded
- Images are organized by user ID for easy management
