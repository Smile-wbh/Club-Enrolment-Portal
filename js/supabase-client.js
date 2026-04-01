(function (window) {
  'use strict';

  function readConfig() {
    var config = window.APP_CONFIG || {};

    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase browser config. Create js/supabase-config.js first.');
    }

    return config;
  }

  function getSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase JS library is not loaded.');
    }

    if (!window.__clubPortalSupabase) {
      var config = readConfig();
      window.__clubPortalSupabase = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
      );
    }

    return window.__clubPortalSupabase;
  }

  window.getSupabaseClient = getSupabaseClient;
})(window);
