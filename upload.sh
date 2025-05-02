#!/bin/sh
AWS_PROFILE=vector
BUCKET=cdn-antil-jp
TARGET=$1

if [ -n "$TARGET" ] && [ -e "$TARGET" ]; then
	DIR=$(dirname "$TARGET" | sed 's#^\./##')
	if [ "$DIR" = "." ]; then
  	DIR=""
	fi
	[ -n "$DIR" ] && DIR="$DIR/"
	aws --profile=${AWS_PROFILE} s3 cp ${TARGET} s3://${BUCKET}/${DIR}
else
	echo "ローカルに存在するファイルまたはディレクトリのPathを指定してください。"
fi

