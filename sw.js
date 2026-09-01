/* Service worker приложения «Моё расписание».

   Задача одна: приложение должно открываться без сети. Оно и так работает
   офлайн — внутри index.html нет ни одного внешнего запроса, — но саму
   страницу браузер по-прежнему просит у сервера, и без интернета показывает
   ошибку. Здесь она берётся из кэша.

   Стратегия — «отдать из кэша, обновить в фоне». Открытие всегда мгновенное и
   не зависит от связи, а свежая версия, если она есть, скачивается следом и
   достаётся при следующем запуске. Обратный порядок (сначала сеть) означал бы
   ожидание на каждом запуске и пустой экран в метро.

   Кэшируется только своё: index.html, манифест и иконки. Запросы к GitHub API
   (резервные копии) через service worker не проходят вовсе — им место в сети,
   а не в кэше. */

var CACHE = 'raspisanie-v1';
var ASSETS = ['./', './index.html', './manifest.webmanifest',
              './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function(e){
  // skipWaiting: новая версия вступает в силу сразу, без ожидания закрытия
  // всех вкладок. Приложение одностраничное, «половины старой версии» тут
  // случиться не может.
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  // Чужие адреса не трогаем: это будущая синхронизация с GitHub, ей кэш
  // только помешает. И POST/PUT кэшировать нельзя в принципе.
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(caches.open(CACHE).then(function(cache){
    return cache.match(req).then(function(cached){
      var network = fetch(req).then(function(res){
        // В кэш кладём только удачные ответы. Иначе туда однажды попадёт
        // страница ошибки и приложение перестанет открываться совсем.
        if(res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(function(){ return cached; });
      return cached || network;
    });
  }));
});
