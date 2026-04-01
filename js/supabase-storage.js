(function (window) {
  'use strict';

  var BUCKET_ID = 'portal-media';

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeId(value) {
    return trimText(value);
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function isConfigured() {
    var config = window.APP_CONFIG || {};
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && getSupabaseClientSafe());
  }

  function randomToken() {
    return Math.random().toString(36).slice(2, 10);
  }

  function sanitizeSegment(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file';
  }

  function inferExtension(file) {
    var type = trimText(file && file.type).toLowerCase();
    if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/gif') return 'gif';
    if (type === 'image/svg+xml') return 'svg';

    var name = trimText(file && file.name);
    var parts = name.split('.');
    if (parts.length > 1) {
      return sanitizeSegment(parts.pop());
    }
    return 'bin';
  }

  function buildObjectPath(userId, folder, file) {
    return [
      normalizeId(userId),
      sanitizeSegment(folder),
      Date.now() + '-' + randomToken() + '.' + inferExtension(file)
    ].join('/');
  }

  async function uploadAsset(file, userId, folder) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase Storage is not configured.');
    if (!normalizeId(userId)) throw new Error('storage_user_required');

    var objectPath = buildObjectPath(userId, folder, file);
    var result = await client.storage.from(BUCKET_ID).upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: trimText(file && file.type) || undefined
    });

    if (result.error) throw result.error;

    var publicResult = client.storage.from(BUCKET_ID).getPublicUrl(objectPath);
    var publicUrl = trimText(publicResult && publicResult.data && publicResult.data.publicUrl);
    if (!publicUrl) throw new Error('storage_public_url_failed');

    return {
      bucket: BUCKET_ID,
      path: objectPath,
      publicUrl: publicUrl
    };
  }

  function mapStorageError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('storage_user_required') > -1) return 'Please sign in again before uploading files.';
    if (text.indexOf('row-level security') > -1) return 'Supabase Storage permissions are not set up yet. Please rerun schema.sql.';
    if (text.indexOf('bucket') > -1 && text.indexOf('not found') > -1) return 'The Supabase Storage bucket has not been created yet. Please rerun schema.sql.';
    if (text.indexOf('mime') > -1 || text.indexOf('type') > -1) return 'This file type is not allowed in Supabase Storage.';
    if (text.indexOf('payload too large') > -1 || text.indexOf('file size') > -1) return 'This file is too large to upload.';
    if (text.indexOf('storage_public_url_failed') > -1) return 'The file uploaded, but the public URL could not be generated.';
    return trimText(error && error.message) || 'Unable to upload this file to Supabase Storage right now.';
  }

  window.clubStorageSupabase = {
    bucketId: BUCKET_ID,
    isConfigured: isConfigured,
    uploadProfileAvatar: function (file, userId) {
      return uploadAsset(file, userId, 'avatars');
    },
    uploadForumPostImage: function (file, userId) {
      return uploadAsset(file, userId, 'forum-posts');
    },
    uploadForumCommentImage: function (file, userId) {
      return uploadAsset(file, userId, 'forum-comments');
    },
    uploadClubCoverImage: function (file, userId) {
      return uploadAsset(file, userId, 'club-covers');
    },
    uploadForumCoverImage: function (file, userId) {
      return uploadAsset(file, userId, 'forum-covers');
    },
    uploadForumVideo: function (file, userId) {
      return uploadAsset(file, userId, 'forum-videos');
    },
    mapStorageError: mapStorageError
  };
})(window);
