all: ace-build-version Immutable.js
ace-build-version: ace-builds
	#cd ace-builds; git checkout v1.1.9
	cd ace-builds; git checkout v1.2.3
ace-builds:
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds
Immutable.js:
	curl https://raw.githubusercontent.com/facebook/immutable-js/master/dist/immutable.min.js > Immutable.js
