#!/bin/bash

echo Stopping previous process

TARGETENV=development

if [ ! -z "$1" ]
then
TARGETENV=$1
fi

PROJECT=BBH
FOLDER=BBH_API

if [ ! -z "~/$FOLDER/$PROJECT_$TARGETENV.log" ]
then
    sudo touch ~/$FOLDER/$PROJECT_$TARGETENV.log
    sudo chmod a+rw ~/$FOLDER/$PROJECT_$TARGETENV.log
fi

forever stop $PROJECT_$TARGETENV

echo Previous process killed

echo Initializing new server environment: $TARGETENV

NODE_ENV=$TARGETENV forever start --uid "$PROJECT_$TARGETENV" --append -l ~/$FOLDER/$PROJECT_$TARGETENV.log ../api/api.js

echo Server initialized
