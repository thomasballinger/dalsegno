all: ace-builds Immutable.js bundle.js
ace-builds-before-patch:
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds-before-patch
ace-builds: ace-builds-before-patch lightened_colors.diff
	cd ace-builds-before-patch; git checkout -f v1.2.3
	patch ace-builds-before-patch/src-noconflict/theme-solarized_light.js lightened_colors.diff
	rm -rf ace-builds
	mkdir ace-builds
	cp -rf ace-builds-before-patch/src-noconflict ace-builds
ace-build-src-noconflict: ace-builds
	/ace-builds/src-noconflict/
Immutable.js:
	curl https://raw.githubusercontent.com/facebook/immutable-js/master/dist/immutable.min.js > Immutable.js
lazycanvasbundle.js: LazyCanvasCtx.js
	webpack
bundle.js: src/*.js examples/*.js DalSegno.js LazyCanvasCtx.js
	webpack

index_with_tracking: index.html
	./addGoogleTracking googletracking.html index.html index_with_tracking

fullscreen_with_tracking: fullscreen/index.html
	./addGoogleTracking googletracking.html fullscreen/index.html fullscreen_with_tracking

deploy: bundle.js bundle.js.map ace-builds index_with_tracking fullscreen_with_tracking
	rsync -r --verbose --delete main.css embed.css reset.css about ace-builds fullscreen bundle.js bundle.js.map segno.svg tom:/home/tomb/dalsegno
	rsync index_with_tracking tom:/home/tomb/dalsegno/index.html
	rsync fullscreen_with_tracking tom:/home/tomb/dalsegno/fullscreen/index.html
	rm index_with_tracking
	rm fullscreen_with_tracking
