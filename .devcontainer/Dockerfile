############################
######   BUNGABUNGA   ######
### 1 image, all desires ###
### latest is greatest!  ###
############################
######    HYDRANET    ######
############################
### Rust, Node, Solidity ###
### Foundry, Hardhat, ET ###
### Tenderly, OZ Tools   ###
############################
############################

############################
###  DEVCONTAINER META   ###
############################
# ARG DVC_CHANNEL="dev" # currently using 'dev' because of https://github.com/nodejs/docker-node/issues/1912
ARG DVC_CHANNEL="1"
ARG DVC_ARCH="arm"
ARG DVC_OS="linux"
ARG DVC_OS_DISTRIBUTION="debian"
ARG DVC_OS_RELEASE="bookworm"
ARG DVC_NODE_MAJOR="20"
ARG DVC_NODE="20.4"
ARG DVC_RUST="1.70.0"
ARG DVC_GCLOUD="438.0.0"
ARG DVC_AWSCLI=""
ARG DVC_USER="code"
ARG DVC_GROUP="dvc"

############################
### BASE Debian, Node 20 ###
############################
ARG VARIANT=${DVC_NODE_MAJOR}-${DVC_OS_RELEASE}
FROM mcr.microsoft.com/devcontainers/typescript-node:${DVC_CHANNEL}-${VARIANT}

############################
###  DEVCONTAINER SETUP  ###
############################
ARG DVC_ARCH
ARG DVC_OS
ARG DVC_OS_DISTRIBUTION
ARG DVC_OS_RELEASE
ARG DVC_NODE
ARG DVC_RUST
ARG DVC_GCLOUD
ARG DVC_AWSCLI
ARG DVC_USER
ARG DVC_GROUP
ENV DVC_USER=${DVC_USER}
ENV DVC_GROUP=${DVC_GROUP}
ENV DVC_HOME=/home/${DVC_USER}

WORKDIR /tmp

## Install generic tools + os packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive &&\
    apt-get -y install --no-install-recommends \
        gnupg2 libc++-dev libc++abi-dev \
        make gcc \
        python3 python3-dev python3-crcmod python3-pip

## User config
RUN groupadd -g 3000 ${DVC_GROUP} &&\
    useradd -m -U -G ${DVC_GROUP},sudo,node,npm,nvm -u 2000 -s /bin/zsh ${DVC_USER} &&\
    useradd -m -U -G ${DVC_GROUP},sudo,node,npm,nvm -u 2999 -s /bin/bash vscode &&\
    echo "${DVC_GROUP} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/vscode &&\
    echo "${DVC_USER} ALL=(ALL) NOPASSWD:ALL" >>/etc/sudoers.d/vscode &&\
    echo "vscode ALL=(ALL) NOPASSWD:ALL" >>/etc/sudoers.d/vscode &&\
    echo "node ALL=(ALL) NOPASSWD:ALL" >>/etc/sudoers.d/vscode

############################
###         Rust         ###
############################
ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/opt/cargo/bin:$PATH \
    RUST_VERSION=${DVC_RUST}
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain $RUST_VERSION &&\
    rustup --version &&\
    cargo --version &&\
    rustc --version

############################
### Node.js, Typescript  ###
############################

# Exact node version
RUN su ${DVC_USER} -c "source /usr/local/share/nvm/nvm.sh && nvm install ${DVC_NODE} &&\
    nvm alias default ${DVC_NODE} &&\
    nvm use default &&\
    npm install -g npm@latest &&\
    npm install -g typescript@latest"

############################
###  Cloud / Deployment  ###
############################
## AWS
# TODO #

## Google Cloud
RUN mkdir -p /opt/google-cloud-sdk && chown ${DVC_USER}:${DVC_GROUP} /opt/google-cloud-sdk
RUN su ${DVC_USER} -c "cd /opt &&\
    curl https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-${DVC_GCLOUD}-${DVC_OS}-${DVC_ARCH}.tar.gz \
    | tar xvz -- &&\
    cd ~ &&\
    ln -s /opt/google-cloud-sdk google-cloud-sdk &&\
    ./google-cloud-sdk/install.sh -q --usage-reporting false"

## Cloudflare
RUN su ${DVC_USER} -c "npm install -g wrangler"

############################
###       Solidity       ###
############################
# Hardhat
RUN su ${DVC_USER} -c "npm install -g hardhat"

# Foundry
RUN su ${DVC_USER} -c "curl -L https://foundry.paradigm.xyz | bash &&\
    source ${DVC_HOME}/.zshenv &&\
    foundryup"

# Tenderly
RUN curl https://raw.githubusercontent.com/Tenderly/tenderly-cli/master/scripts/install-linux.sh | sh

############################
### TOOLS, CONFIG, SETUP ###
############################

# Init script and default home dir
COPY files/init.sh /opt/entrypoint/init.sh
RUN export INIT_HOME=/opt/entrypoint/home &&\
    cp -r ${DVC_HOME} ${INIT_HOME} &&\
    cp -r /home/node/.oh-my-zsh ${INIT_HOME}/ &&\
    cp /home/node/.zshrc ${INIT_HOME}/ &&\
    chgrp -R ${DVC_GROUP} ${INIT_HOME}

# su ${DVC_USER}
USER ${DVC_USER}
WORKDIR /home/${DVC_USER}

# Slot20: Find the slot that is responsible for the balance state of a ERC20 token
RUN npm install -g slot20

# CRA: React App
RUN npm install -g create-react-app
