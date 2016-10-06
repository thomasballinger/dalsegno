all: ace-builds Immutable.js bundle.js
ace-builds-before-patch:
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds-before-patch
ace-builds: ace-builds-before-patch lightened_colors.diff
	cd ace-builds-before-patch; git checkout v1.2.3
	patch ace-builds-before-patch/src-noconflict/theme-solarized_light.js lightened_colors.diff
	cp -rf ace-builds-before-patch ace-builds
Immutable.js:
	curl https://raw.githubusercontent.com/facebook/immutable-js/master/dist/immutable.min.js > Immutable.js
lazycanvasbundle.js:
	webpack
bundle.js:
	webpack

index_with_tracking: index.html
	./addGoogleTracking googletracking.html index.html index_with_tracking

about_with_tracking: about/index.html
	./addGoogleTracking googletracking.html about/index.html about_with_tracking

deploy: bundle.js bundle.js.map ace-builds index_with_tracking about_with_tracking
	rsync -r --verbose dalsegno.css ace-builds about bundle.js bundle.js.map tom:/home/tomb/dalsegno
	rsync index_with_tracking tom:/home/tomb/dalsegno/index.html
	rsync about_with_tracking tom:/home/tomb/dalsegno/about/index.html
	rm index_with_tracking
	rm about_with_tracking
