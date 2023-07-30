#!/usr/bin/env zsh
DVC_HOME=/home/${DVC_USER}
INIT_HOME=${INIT_HOME:-"/opt/entrypoint/home"}

function copy {
    [[ ! -e ${DVC_HOME}/$1 ]] && cp -r ${INIT_HOME}/$1 ${DVC_HOME}/$1
}

function link {
    [[ ! -e ${DVC_HOME}/$1 ]] && (sh -c "cd ${DVC_HOME} && ln -s /opt/$1 $1")
}

# Setup home directory symlinks
# if [ ! -d "${DVC_HOME}/google-cloud-sdk" ]; then (sh -c "cd ${DVC_HOME} && ln -s /opt/google-cloud-sdk google-cloud-sdk"); fi
# if [ ! -f "${DVC_HOME}/.zshrc" ]; then cp ${INIT_HOME}/.zshrc ${DVC_HOME}/.zshrc; fi
link google-cloud-sdk
copy .npm
copy .config
copy .oh-my-zsh
copy .zshrc
copy .bashrc
copy .profile
source ${DVC_HOME}/.zshrc
