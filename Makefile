all: ace-builds Immutable.js
ace-builds:
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds
	cd ace-builds; git checkout v1.1.9
Immutable.js:
	curl https://raw.githubusercontent.com/facebook/immutable-js/master/dist/immutable.min.js > Immutable.js
