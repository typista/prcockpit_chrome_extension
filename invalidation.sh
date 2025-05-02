#!/bin/sh
# ./invalidation.sh '/*'
set -f  # グロブ展開を無効化

AWS_PROFILE=vector
BUCKET=cdn-antil-jp
DISTRIBUTION_ID=E12BGN0BVUF5S9
PATTERN=${1}

if [ -n "$PATTERN" ]; then
	JSON=`aws --profile=${AWS_PROFILE} cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID} --paths "${PATTERN}"`
	RESULT=`echo ${JSON} | jq -r '.Invalidation.Id, .Invalidation.Status'`
	set ${RESULT}
	INVALIDATION_ID=${1}
	STATUS=${2}
	echo "INVALIDATION_ID: ${INVALIDATION_ID}"
	echo "STATUS: ${STATUS}"
	
	while true
	do
		sleep 1
		JSON=`aws --profile=${AWS_PROFILE} cloudfront get-invalidation --distribution-id ${DISTRIBUTION_ID} --id ${INVALIDATION_ID}`
		RESULT=`echo ${JSON} | jq -r '.Invalidation.Status'`
		set ${RESULT}
		STATUS=${1}
		echo "STATUS: ${STATUS}"
		if [ "$STATUS" != "InProgress" ]; then
			break;
		fi
	done
else
	echo "InvalidationするPathパターンを指定してください。"
fi

