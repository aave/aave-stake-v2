FROM ethereum/solc:0.7.5 as build-deps

FROM node:14
COPY --from=build-deps /usr/bin/solc /usr/bin/solc

RUN npm config set @aave-tech:registry https://gitlab.com/api/v4/projects/19392283/packages/npm/
