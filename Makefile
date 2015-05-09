all: ace-builds
ace-builds: 
	git clone git://github.com/ajaxorg/ace-builds.git ace-builds
	cd ace-builds; git checkout v1.1.9
