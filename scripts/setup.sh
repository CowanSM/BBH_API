#!/bin/bash

#We should always have a local config file named config
configFile="config"
if [ -a "$configFile" ]
then
    while read -r line
    do
        pushd ..
        package=$line
        echo Initializing $package Node package
        #sh -c 'cd .. && sudo npm install $package'
        sudo npm install $package
        popd
    done < "$configFile"
fi