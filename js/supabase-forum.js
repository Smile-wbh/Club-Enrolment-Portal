(function (window) {
  'use strict';

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeId(value) {
    return trimText(value);
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
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

  function toArray(value) {
    return Array.isArray(value) ? value.map(function (item) { return trimText(item); }).filter(Boolean) : [];
  }

  function formatTime(value) {
    var text = trimText(value);
    if (!text) return '';
    var date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
  }

  function timeValue(value) {
    var text = trimText(value);
    if (!text) return 0;
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function normalizeChannel(channel, videoUrl) {
    var text = trimText(channel);
    if (trimText(videoUrl)) return 'Video';
    if (/video/i.test(text)) return 'Video';
    return 'Community';
  }

  function normalizeVisibility(value) {
    var text = trimText(value).toLowerCase();
    if (text === 'followers' || text === 'friends' || text === 'private') return text;
    return 'public';
  }

  function compactClubName(club) {
    var row = club || {};
    var name = trimText(row.name);
    var slug = trimText(row.slug);
    if (name) {
      return name.replace(/\s+(club|society)$/i, '').trim() || name;
    }
    return slug
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(function (item) {
        return item.charAt(0).toUpperCase() + item.slice(1);
      })
      .join(' ') || 'General';
  }

  function buildCommentTree(rows, currentUserId, fallbackEmail) {
    var commentMap = {};
    var rootMap = {};

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !row.id) return;
      var mapped = {
        id: normalizeId(row.id),
        source: 'supabase',
        ownerId: normalizeId(row.author_id),
        ownerEmail: normalizeId(row.author_id) === normalizeId(currentUserId) ? normalizeEmail(fallbackEmail) : '',
        author: trimText(row.author_name) || 'User',
        avatarUrl: trimText(row.author_avatar_url),
        imageUrl: trimText(row.image_url),
        text: trimText(row.content),
        time: formatTime(row.created_at),
        createdAt: trimText(row.created_at),
        createdTs: timeValue(row.created_at),
        likes: Number(row.likes_count || 0),
        replies: []
      };
      commentMap[mapped.id] = mapped;
      var parentKey = normalizeId(row.parent_comment_id) || '__root__';
      if (!rootMap[parentKey]) rootMap[parentKey] = [];
      rootMap[parentKey].push(mapped);
    });

    Object.keys(rootMap).forEach(function (parentKey) {
      if (parentKey === '__root__') return;
      if (!commentMap[parentKey]) return;
      commentMap[parentKey].replies = rootMap[parentKey];
    });

    return rootMap.__root__ || [];
  }

  function mapPostRow(row, comments, currentUserId, fallbackEmail) {
    if (!row || !row.id) return null;
    return {
      id: normalizeId(row.id),
      source: 'supabase',
      ownerId: normalizeId(row.author_id),
      ownerEmail: normalizeId(row.author_id) === normalizeId(currentUserId) ? normalizeEmail(fallbackEmail) : '',
      channel: normalizeChannel(row.channel, row.video_url),
      type: trimText(row.post_type) || 'Question',
      club: compactClubName(row.club),
      visibility: normalizeVisibility(row.visibility),
      pinned: !!row.pinned,
      author: trimText(row.author_name) || 'User',
      avatarUrl: trimText(row.author_avatar_url),
      title: trimText(row.title),
      content: trimText(row.content),
      videoUrl: trimText(row.video_url),
      videoName: trimText(row.video_name),
      imageUrls: toArray(row.image_urls),
      time: formatTime(row.created_at),
      createdAt: trimText(row.created_at),
      createdTs: timeValue(row.created_at),
      likes: Number(row.likes_count || 0),
      comments: Array.isArray(comments) ? comments : []
    };
  }

  async function fetchPosts(currentUserId, fallbackEmail, onlyMine) {
    var client = getSupabaseClientSafe();
    if (!client) return [];

    var query = client
      .from('forum_posts')
      .select('id, author_id, author_name, author_avatar_url, title, post_type, content, channel, visibility, pinned, image_urls, video_url, video_name, likes_count, created_at, club:clubs(name, slug)')
      .order('created_at', { ascending: false });

    if (onlyMine && normalizeId(currentUserId)) {
      query = query.eq('author_id', normalizeId(currentUserId));
    }

    var postResult = await query;
    if (postResult.error) throw postResult.error;

    var posts = Array.isArray(postResult.data) ? postResult.data : [];
    var postIds = posts.map(function (item) { return normalizeId(item && item.id); }).filter(Boolean);
    var comments = [];

    if (postIds.length) {
      var commentResult = await client
        .from('forum_comments')
        .select('id, post_id, parent_comment_id, author_id, author_name, author_avatar_url, content, image_url, likes_count, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: false });

      if (commentResult.error) throw commentResult.error;
      comments = Array.isArray(commentResult.data) ? commentResult.data : [];
    }

    var commentsByPost = {};
    comments.forEach(function (row) {
      var postId = normalizeId(row && row.post_id);
      if (!postId) return;
      if (!commentsByPost[postId]) commentsByPost[postId] = [];
      commentsByPost[postId].push(row);
    });

    return posts.map(function (row) {
      return mapPostRow(
        row,
        buildCommentTree(commentsByPost[normalizeId(row.id)] || [], currentUserId, fallbackEmail),
        currentUserId,
        fallbackEmail
      );
    }).filter(Boolean);
  }

  function clubSlugFromValue(value) {
    var text = trimText(value);
    if (!text || /^general$/i.test(text)) return '';
    return text
      .replace(/\s+(club|society)$/i, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function resolveClubId(value) {
    var slug = clubSlugFromValue(value);
    var client = getSupabaseClientSafe();
    if (!client || !slug) return null;
    var result = await client
      .from('clubs')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (result.error) throw result.error;
    return normalizeId(result.data && result.data.id) || null;
  }

  async function createPost(payload, currentUserId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var clubId = null;
    if (trimText(payload && payload.club) && !/^general$/i.test(trimText(payload && payload.club))) {
      clubId = await resolveClubId(payload.club);
    }

    var result = await client.rpc('create_forum_post', {
      p_title: trimText(payload && payload.title),
      p_post_type: trimText(payload && payload.type) || 'Question',
      p_content: trimText(payload && payload.content),
      p_channel: normalizeChannel(payload && payload.channel, payload && payload.videoUrl),
      p_visibility: normalizeVisibility(payload && payload.visibility),
      p_pinned: !!(payload && payload.pinned),
      p_image_urls: toArray(payload && payload.imageUrls),
      p_video_url: trimText(payload && payload.videoUrl),
      p_video_name: trimText(payload && payload.videoName),
      p_club_id: clubId
    });

    if (result.error) throw result.error;
    var row = result.data || {};
    return mapPostRow({
      id: row.id,
      author_id: row.author_id || currentUserId,
      author_name: row.author_name || trimText(payload && payload.author),
      author_avatar_url: row.author_avatar_url || '',
      title: trimText(payload && payload.title),
      post_type: trimText(payload && payload.type) || 'Question',
      content: trimText(payload && payload.content),
      channel: normalizeChannel(payload && payload.channel, payload && payload.videoUrl),
      visibility: normalizeVisibility(payload && payload.visibility),
      pinned: !!(payload && payload.pinned),
      image_urls: toArray(payload && payload.imageUrls),
      video_url: trimText(payload && payload.videoUrl),
      video_name: trimText(payload && payload.videoName),
      likes_count: row.likes_count || 0,
      created_at: row.created_at || new Date().toISOString(),
      club: { slug: clubSlugFromValue(payload && payload.club), name: trimText(payload && payload.club) }
    }, [], currentUserId, fallbackEmail);
  }

  async function updatePost(postId, patch) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var updateData = {};
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'pinned')) updateData.pinned = !!patch.pinned;
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'visibility')) updateData.visibility = normalizeVisibility(patch.visibility);
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'content')) updateData.content = trimText(patch.content);
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'title')) updateData.title = trimText(patch.title);

    var result = await client
      .from('forum_posts')
      .update(updateData)
      .eq('id', normalizeId(postId))
      .select('id')
      .single();

    if (result.error) throw result.error;
    return true;
  }

  async function deletePost(postId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('forum_posts')
      .delete()
      .eq('id', normalizeId(postId));
    if (result.error) throw result.error;
    return true;
  }

  async function createComment(postId, parentCommentId, content, imageUrl, currentUserId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client.rpc('create_forum_comment', {
      p_post_id: normalizeId(postId),
      p_parent_comment_id: normalizeId(parentCommentId) || null,
      p_content: trimText(content),
      p_image_url: trimText(imageUrl)
    });
    if (result.error) throw result.error;

    var row = result.data || {};
    return {
      id: normalizeId(row.id),
      source: 'supabase',
      ownerId: normalizeId(row.author_id || currentUserId),
      ownerEmail: normalizeId(row.author_id || currentUserId) === normalizeId(currentUserId) ? normalizeEmail(fallbackEmail) : '',
      author: trimText(row.author_name) || 'User',
      avatarUrl: trimText(row.author_avatar_url),
      imageUrl: trimText(row.image_url),
      text: trimText(row.content),
      time: formatTime(row.created_at || new Date().toISOString()),
      createdAt: trimText(row.created_at),
      createdTs: timeValue(row.created_at),
      likes: Number(row.likes_count || 0),
      replies: []
    };
  }

  async function deleteComment(commentId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('forum_comments')
      .delete()
      .eq('id', normalizeId(commentId));
    if (result.error) throw result.error;
    return true;
  }

  async function likePost(postId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client.rpc('like_forum_post', {
      p_post_id: normalizeId(postId)
    });
    if (result.error) throw result.error;
    return Number(result.data || 0);
  }

  async function likeComment(commentId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client.rpc('like_forum_comment', {
      p_comment_id: normalizeId(commentId)
    });
    if (result.error) throw result.error;
    return Number(result.data || 0);
  }

  function mapForumActionError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('not_authenticated') > -1) return 'Please log in again before using the forum.';
    if (text.indexOf('missing_post_content') > -1) return 'Please enter content or upload media before publishing.';
    if (text.indexOf('post_not_found') > -1) return 'This post is no longer available.';
    if (text.indexOf('comment_not_found') > -1) return 'This comment is no longer available.';
    return trimText(error && error.message) || 'Unable to sync the forum action to Supabase right now.';
  }

  window.clubForumSupabase = {
    isConfigured: isConfigured,
    fetchForumFeed: function (currentUserId, fallbackEmail) {
      return fetchPosts(currentUserId, fallbackEmail, false);
    },
    fetchMyPosts: function (currentUserId, fallbackEmail) {
      return fetchPosts(currentUserId, fallbackEmail, true);
    },
    createPost: createPost,
    updatePost: updatePost,
    deletePost: deletePost,
    createComment: createComment,
    deleteComment: deleteComment,
    likePost: likePost,
    likeComment: likeComment,
    mapForumActionError: mapForumActionError,
    normalizeId: normalizeId
  };
})(window);
