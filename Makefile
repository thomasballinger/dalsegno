all: ace-build-version Immutable.js bundle.js
ace-build-version: ace-builds
	#cd ace-builds; git checkout v1.1.9
	cd ace-builds; git checkout v1.2.3
ace-builds:
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds
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
	rsync -r dalsegno.css ace-builds about bundle.js tom:/home/tomb/dalsegno
	rsync index_with_tracking tom:/home/tomb/dalsegno/index.html
	rsync about_with_tracking tom:/home/tomb/dalsegno/about/index.html
	rm index_with_tracking
	rm about_with_tracking
