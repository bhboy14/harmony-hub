-- Drop existing conflicting storage policies
DROP POLICY IF EXISTS "Users can delete own music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own music files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload music" ON storage.objects;
DROP POLICY IF EXISTS "Office shared listening access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload music files" ON storage.objects;

-- Recreate clean storage policies for office shared mode
-- Anyone can listen (public read access)
CREATE POLICY "Office shared listening access"
ON storage.objects FOR SELECT
USING (bucket_id = 'music-files');

-- Only authenticated users can upload to their folder
CREATE POLICY "Authenticated users can upload music"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'music-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can update their own files
CREATE POLICY "Users can update own music files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'music-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can delete their own files
CREATE POLICY "Users can delete own music files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'music-files' AND (storage.foldername(name))[1] = auth.uid()::text);