(function (window) {
  'use strict';

  var RESET_PARAMS = {
    resetLocalData: true,
    freshLocal: true,
    devFresh: true
  };

  function hasResetParam(params) {
    return Object.keys(RESET_PARAMS).some(function (key) {
      return params.has(key);
    });
  }

  function clearStorage(store) {
    try {
      if (store && typeof store.clear === 'function') store.clear();
    } catch (error) {}
  }

  function clearCacheStorage() {
    try {
      if (!window.caches || typeof window.caches.keys !== 'function') return;
      window.caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return window.caches.delete(key);
        }));
      }).catch(function () {});
    } catch (error) {}
  }

  function clearIndexedDb() {
    try {
      if (!window.indexedDB || typeof window.indexedDB.databases !== 'function') return;
      window.indexedDB.databases().then(function (databases) {
        (Array.isArray(databases) ? databases : []).forEach(function (database) {
          if (database && database.name) window.indexedDB.deleteDatabase(database.name);
        });
      }).catch(function () {});
    } catch (error) {}
  }

  function cleanUrl(params) {
    Object.keys(RESET_PARAMS).forEach(function (key) {
      params.delete(key);
    });

    try {
      if (!window.history || typeof window.history.replaceState !== 'function') return;
      var query = params.toString();
      var nextUrl = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
      window.history.replaceState(null, document.title, nextUrl);
    } catch (error) {}
  }

  var params = new URLSearchParams(window.location.search);
  if (!hasResetParam(params)) return;

  window.__clubPortalLocalDataReset = true;
  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  clearCacheStorage();
  clearIndexedDb();
  cleanUrl(params);
})(window);
