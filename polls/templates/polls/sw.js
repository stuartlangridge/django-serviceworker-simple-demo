const cacheName = 'polls';
const offlinePage = '/polls/offline/';

addEventListener('install', installEvent => {
  skipWaiting();
  installEvent.waitUntil(
    caches.open(cacheName)
    .then(cache => {
      return cache.add(offlinePage);
    })
  );
});

addEventListener('activate', activateEvent => {
  clients.claim();
});

addEventListener('fetch',  fetchEvent => {
  const request = fetchEvent.request;
  if (request.method !== 'GET') {
    return;
  }
  fetchEvent.respondWith(async function() {
    const responseFromFetch = fetch(request);
    fetchEvent.waitUntil(async function() {
      const responseCopy = (await responseFromFetch).clone();
      const myCache = await caches.open(cacheName);
      await myCache.put(request, responseCopy);
    }());
    if (request.headers.get('Accept').includes('text/html')) {
      try {
        return await responseFromFetch;
      }
      catch(error) {
        const responseFromCache = await caches.match(request);
        return responseFromCache || caches.match(offlinePage);
      }
    } else {
      const responseFromCache = await caches.match(request);
      return responseFromCache || responseFromFetch;
    }
  }());
});

async function getCSRFToken() {
  let response = await fetch("/polls/get_csrftoken_from_cookie");
  let decoded = await response.json();
  return decoded.token;
}

async function fetcher(data) {
  try {
    let csrftoken = await getCSRFToken()
    let form = new URLSearchParams(data.value.data);
    form.set("csrfmiddlewaretoken", csrftoken);
    const response = await fetch(data.value.url, {
      method: "POST",
      body: form.toString(),
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrftoken,
        'Content-Type': "application/x-www-form-urlencoded"
      }
    })
    const result = await response.json();
    return { success: result.success, key: data.key }
  } catch(e) {
    return { success: false, key: data.key }
  }
}

function removeFromDB(keys) {
  return new Promise((resolve, reject) => {
    let db = indexedDB.open("votes");
    db.onsuccess = e => {
      function removeNextKey() {
        let nextKey = keys.shift();
        if (!nextKey) { return resolve(); }
        let rq = store.delete(nextKey);
        rq.onsuccess = ev => { removeNextKey(); }
        rq.onerror = err => { console.error(err); removeNextKey(); }
      }
      let store = db.result.transaction("votes", "readwrite").objectStore("votes");
      removeNextKey();
    }
  })
}

async function sendToServer() {
  let pending = await readDB();
  let results = await Promise.all(pending.map(fetcher))
  await removeFromDB(results.filter(r => r.success).map(r => r.key));
}

function readDB() {
  return new Promise((resolve, reject) => {
    let db = indexedDB.open("votes");
    db.onsuccess = e => {
      let results = [];
      let rq = db.result.transaction("votes", 'readwrite').objectStore("votes").openCursor();
      rq.onsuccess = ev => {
        let cursor = ev.target.result;
        if (cursor) {
          results.push({key: cursor.primaryKey, value: cursor.value});
          cursor.continue();
        } else {
          resolve(results);
        }
      }
    }
    db.onerror = err => { reject(err); }
  })
}

self.onsync = function(event) {
  console.log("bgsync", event.tag);
  if (event.tag == 'votes-post') {
    event.waitUntil(sendToServer());
  }
}