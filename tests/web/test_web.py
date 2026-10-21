"""Behavior checks against a static server with the actual Pages project prefix."""
import functools
import http.server
import importlib.util
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_web', ROOT / 'scripts/build_web.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
PREFIX = '/halloween-hub-web/'


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(PREFIX):]
        super().do_GET()

    def do_HEAD(self):
        if not self.path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(PREFIX):]
        super().do_HEAD()

    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Closing a test tab cancels in-flight offline-cache downloads.


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        site = builder.build()
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(site)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}{PREFIX}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':800, 'height':480})
        self.page = self.context.new_page()
        self.errors, self.bad_requests = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.bad_requests.append(request.url) if '/api/' in request.url or '/static/' in request.url else None)
        self.page.goto(self.url)
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Ready')")

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.bad_requests, [])

    def hub(self, code):
        return self.page.evaluate("async () => { const {hub, countdown, zonedEpoch} = await import('./browser-service.js'); await hub.ready; " + code + " }")

    def test_adventures_and_keyboard(self):
        self.hub("await hub.settings({reduced_motion:true});")
        self.page.locator('#pumpkin').click()
        self.page.locator('[data-choice="play"]').click()
        for game in ['ghost', 'paint', 'quest']:
            self.page.locator(f'[data-game="{game}"]').click()
            if game == 'ghost':
                for i in range(1, 4):
                    self.page.get_by_role('button', name=f'Find ghost {i}', exact=True).click()
                self.page.locator('#reward-again').click()
            elif game == 'paint':
                self.page.locator('[data-paint="eyes"]').click()
                self.page.locator('#paint-done').click()
                self.page.locator('#reward-again').click()
            else:
                self.page.locator('#visitor-menu-back').click()
            self.page.locator('[data-choice="play"]').click()
        self.page.locator('#visitor-back').click()
        self.page.wait_for_function("!document.querySelector('#pumpkin').disabled")
        self.page.locator('#pumpkin').click()
        self.page.locator('[data-choice="story"]').click()
        for index in range(3):
            self.page.locator(f'[data-story="{index}"]').click()
            while self.page.locator('[data-next]').count():
                self.page.locator('[data-next]').first.click()
            self.page.locator('#story-end').click()
            self.page.locator('#reward-again').click()
            self.page.locator('[data-choice="story"]').click()
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#visitor-dialog').is_visible())
        self.page.wait_for_function("!document.querySelector('#pumpkin').disabled")
        self.page.locator('#pumpkin').click()
        self.page.locator('[data-choice="surprise"]').click()
        self.page.wait_for_function("document.querySelector('#scene-dialog').open || !document.querySelector('[data-choice]')")
        self.page.keyboard.press('Escape')

    def test_persistence_audio_and_stopped_restart(self):
        result = self.hub("""
            await hub.settings({volume:23, timezone:'Europe/London'});
            const record = await hub.request('/records','POST',{kind:'task',name:'Decorate'});
            await hub.request('/records/'+record.id,'PATCH',{done:true});
            const response=await fetch('./assets/whisper.wav'), blob=await response.blob();
            const file=new File([blob],'test.wav',{type:'audio/wav'});
            const data=new FormData();data.append('file',file);
            const first=await hub.request('/tracks','POST',data);
            const duplicate=await hub.request('/tracks','POST',data);
            await hub.request('/effects','POST',data);
            hub.command({action:'activate'});hub.scan.active=true;
            return {id:first.id,duplicate:duplicate.duplicate};
        """)
        self.assertTrue(result['duplicate'])
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Ready')")
        state = self.hub('return hub.snapshot();')
        self.assertEqual(state['settings']['volume'], 23)
        self.assertEqual(state['records'][0]['name'], 'Decorate')
        self.assertTrue(state['records'][0]['done'])
        self.assertEqual(len([item for item in state['tracks'] if not item.get('included')]), 1)
        self.assertEqual(len([item for item in state['effects'] if not item.get('included')]), 1)
        self.assertFalse(state['haunt']['active'])
        self.assertFalse(state['scan']['active'])
        self.assertTrue(self.page.locator('#music-player').evaluate('(el)=>el.paused'))
        self.assertEqual(self.page.locator('#sound-toggle').get_attribute('aria-label'), 'Enable audio')
        self.assertTrue(self.hub("return !!hub.urls.get(hub.audio[0].id);"))
        # Exercise actual decoding of a persisted Blob through the Library UI.
        self.page.locator('#dashboard .welcome-weather button').click()
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('Tab')
        self.page.locator('[data-screen="party"]').click()
        self.page.locator('[data-open="music-dialog"]').click()
        self.page.locator('#track-list .track-row').filter(has_text='test.wav').locator('button.primary').click()
        self.page.wait_for_function("document.querySelector('#music-player').currentTime > 0")
        self.assertTrue(self.page.locator('#music-player').evaluate('(el)=>el.currentSrc.startsWith("blob:")'))

    def test_simulation_completion_logs_and_dates(self):
        result=self.hub("""
            const states=[];
            for(const name of hub.snapshot().scenes){
                hub.command({action:'play',scene:name});
                hub.started-=10500;hub.stepScene();states.push(hub.haunt.progress>=50&&hub.haunt.motion);
                hub.started-=11000;hub.stepScene();states.push(!hub.haunt.active&&hub.haunt.progress===100);
            }
            await hub.request('/scan','POST',{active:true});hub.lastScan=-1000;await hub.tick();
            const scan=hub.snapshot().scan;
            await hub.request('/scan','POST',{active:false});
            let invalid=false;try{await hub.settings({party_date:'2026-03-08T02:30',timezone:'America/Toronto'});}catch{invalid=true;}
            const target=countdown({...hub.data.settings,timezone:'America/Toronto'},Date.parse('2026-10-21T12:00:00Z'));
            return {states,scan,logs:hub.data.detections.length,invalid,target};
        """)
        self.assertTrue(all(result['states']))
        self.assertGreater(result['scan']['emf'], 0)
        self.assertEqual(result['logs'], 1)
        self.assertTrue(result['invalid'])
        self.assertEqual(result['target']['target'], '2026-10-31T04:00:00.000Z')
        with self.page.expect_download() as download:
            self.hub('hub.exportLogs();')
        self.assertEqual(download.value.suggested_filename, 'ghost-detections.csv')

    def test_weather_and_network_failure(self):
        self.context.route('https://geocoding-api.open-meteo.com/**', lambda route: route.fulfill(json={'results':[{'name':'Montreal','country':'Canada','latitude':45.5,'longitude':-73.6}]}))
        self.context.route('https://api.open-meteo.com/**', lambda route: route.fulfill(json={'current':{'temperature_2m':8,'apparent_temperature':6,'weather_code':3,'wind_speed_10m':10}}))
        result=self.hub("const {results}=await hub.locations('Montreal');await hub.settings({location:results[0]});hub.weather();return results;")
        self.assertEqual(result[0]['name'], 'Montreal, Canada')
        self.page.wait_for_function("document.querySelector('#weather-status').textContent.includes('Updated')")
        self.assertEqual(self.hub('return hub.weather().status;'), 'fresh')
        self.context.set_offline(True)
        self.assertEqual(self.hub('return hub.weather().status;'), 'stale')
        self.context.set_offline(False)
        self.context.unroute('https://geocoding-api.open-meteo.com/**')
        self.context.route('https://geocoding-api.open-meteo.com/**', lambda route: route.abort())
        self.assertIn('unavailable', self.hub("try{await hub.locations('London');}catch(error){return error.message;}"))

    def test_storage_denied_and_quota_atomicity(self):
        self.hub("await hub.request('/records','POST',{kind:'guest',name:'Saved guest'});")
        message=self.hub("""
            const original=hub.db.transaction.bind(hub.db);
            hub.db.transaction=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};
            try{await hub.request('/records','POST',{kind:'guest',name:'Must not overwrite'});}catch(error){return error.message;}finally{hub.db.transaction=original;}
        """)
        self.assertTrue(message)
        self.assertEqual(len(self.hub('return hub.data.records;')),1)
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Ready')")
        self.assertEqual(len(self.hub('return hub.data.records;')),1)
        self.context.add_init_script("Object.defineProperty(window,'indexedDB',{get(){throw new Error('Denied');}})")
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Ready')")
        self.assertIn('storage is unavailable', self.hub('return hub.storageNotice;'))
        self.hub("await hub.request('/records','POST',{kind:'guest',name:'Temporary'});")
        self.assertEqual(self.hub('return hub.data.records[0].name;'),'Temporary')

    def test_offline_shell(self):
        self.page.evaluate('async()=>{await navigator.serviceWorker.ready;}')
        self.page.wait_for_function('navigator.serviceWorker.controller !== null')
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Offline')")
        self.assertTrue(self.page.locator('#pumpkin').is_visible())
        self.hub('await hub.settings({reduced_motion:true});')
        self.page.locator('#pumpkin').click()
        self.page.locator('[data-choice="play"]').click()
        self.assertTrue(self.page.locator('[data-game="paint"]').is_visible())

    def test_included_audio_offline_ranges_and_restore(self):
        state=self.hub('return hub.snapshot();')
        self.assertEqual(len(state['tracks']),6)
        self.assertEqual(len(state['effects']),10)
        self.assertTrue(self.page.locator('#ambience-player').evaluate('(el)=>el.paused'))
        self.page.evaluate('async()=>{await navigator.serviceWorker.ready;}')
        self.page.wait_for_function('navigator.serviceWorker.controller !== null')
        self.context.set_offline(True)
        result=self.page.evaluate("""async()=>{
            const {BUNDLED_AUDIO}=await import('./audio-manifest.js');
            const result=[];
            for(const item of BUNDLED_AUDIO){
                const response=await fetch(item.url,{headers:{Range:'bytes=0-127'}});
                result.push(response.status===206&&(await response.arrayBuffer()).byteLength===128);
            }
            const response=await fetch(BUNDLED_AUDIO[0].url,{headers:{Range:'bytes=999999999-'}});
            return {result,invalid:response.status};
        }""")
        self.assertTrue(all(result['result']))
        self.assertEqual(result['invalid'],416)
        # Real playback uses the browser's Range requests, rather than a Blob workaround.
        self.page.add_style_tag(content='.welcome-sound{bottom:0!important} #ambience-toggle{translate:none!important}')
        self.page.locator('#ambience-toggle').click()
        self.page.wait_for_function("document.querySelector('#ambience-player').currentTime>0")
        self.assertNotIn('welcome-controls',self.page.locator('body').get_attribute('class') or '')
        self.assertIn('/audio/effects/',self.page.locator('#ambience-player').evaluate('(el)=>el.currentSrc'))
        self.page.locator('#ambience-toggle').click()
        first=self.hub('const item=hub.snapshot().tracks[0];await hub.removeAudio(\'tracks\',item.id);return item.id;')
        duplicate=self.page.evaluate("""async()=>{
            const {hub}=await import('./browser-service.js');
            const {BUNDLED_AUDIO}=await import('./audio-manifest.js');
            const item=BUNDLED_AUDIO.find(item=>item.kind==='tracks');
            const blob=await (await fetch(item.url)).blob();
            return hub.importAudio('tracks',new File([blob],'same-song.mp3',{type:'audio/mpeg'}));
        }""")
        self.assertTrue(duplicate['duplicate'])
        self.assertEqual(duplicate['id'],first)
        self.hub("await hub.removeAudio('tracks',hub.snapshot().tracks[0].id);")
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#connection').textContent.includes('Offline')")
        self.assertNotIn(first,[item['id'] for item in self.hub('return hub.snapshot().tracks;')])
        self.hub("await hub.request('/audio/restore','POST');")
        self.assertEqual(len(self.hub('return hub.snapshot().tracks;')),6)
        self.assertEqual(self.hub('return hub.audio.length;'),0)

    def test_responsive_layouts(self):
        for width,height in [(390,844),(800,480),(1920,1080),(3840,2160)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.page.wait_for_timeout(200)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
            self.assertAlmostEqual(self.page.locator('#app').bounding_box()['width'],width,delta=1)
            for screen in ['haunt','party','detector','dashboard']:
                self.page.evaluate("screen=>document.querySelector(`[data-screen=${screen}]`).click()",screen)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
            self.assertTrue(self.page.locator('#pumpkin').is_visible())

    def test_media_intro_and_idle_fades(self):
        self.page.locator('#pumpkin').click()
        self.page.wait_for_function("document.querySelector('#visitor-cutscene-video')?.currentTime>0")
        self.page.evaluate("()=>{const v=document.querySelector('#visitor-cutscene-video');v.currentTime=v.duration-.15;}")
        self.page.locator('[data-choice="play"]').wait_for()
        self.page.keyboard.press('Escape')
        self.page.wait_for_function("!document.querySelector('#pumpkin').disabled")
        result=self.page.evaluate("""async()=>{
            const {MEDIA}=await import('./media-manifest.js');
            const {IdleBackgroundVideo}=await import('./idle-background-video.js');
            const {hub}=await import('./browser-service.js');
            await hub.settings({reduced_motion:true});
            const background={hold:false}, idle=new IdleBackgroundVideo(background);
            window.testIdle=idle;
            idle.start(MEDIA.cutscenes.find(item=>item.id==='pumpkin-scare'));
            return {pairs:MEDIA.backgrounds.map(item=>item.video_id),fade:idle.fadeMs};
        }""")
        self.assertEqual(result['pairs'],['dracula','nun'])
        self.assertEqual(result['fade'],3500)
        self.page.wait_for_function("window.testIdle.layer.dataset.state==='playing'")
        self.assertEqual(self.page.evaluate('window.testIdle.video.playbackRate'),.5)
        self.page.wait_for_function("window.testIdle.layer.dataset.state==='fading'",timeout=20000)
        self.assertEqual(self.page.evaluate('window.testIdle.layer.style.transitionDuration'),'3500ms')
        self.page.wait_for_function('window.testIdle.video===null',timeout=6000)

    def test_missing_media_and_user_cancellation(self):
        self.context.route('**/media/*.mp4',lambda route:route.abort())
        self.context.route('**/media/*.webm',lambda route:route.abort())
        self.page.locator('#pumpkin').click()
        self.page.locator('[data-choice="play"]').wait_for()
        self.assertIn('could not',self.page.locator('.adventure-notice').inner_text())
        self.page.keyboard.press('Escape')
        self.context.unroute('**/media/*.mp4')
        self.context.unroute('**/media/*.webm')
        self.page.wait_for_function("!document.querySelector('#pumpkin').disabled")
        self.page.locator('#pumpkin').click()
        self.page.wait_for_function("document.querySelector('#visitor-cutscene-video')?.currentTime>0")
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#visitor-cutscene-video').count(),0)
        self.assertFalse(self.page.locator('#visitor-dialog').is_visible())


if __name__ == '__main__':
    unittest.main()
