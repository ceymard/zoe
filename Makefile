export PATH := node_modules/.bin:$(PATH)
# Y

BUILD_DIST = dist

FLAGS = --bundle --target=es2020 --define:process.env.NODE_ENV=\"development\" --tsconfig=./tsconfig.json

.PHONY: ensure_no_links all clean appjs appjsminified image upload appjswatch staticassets

# By default, build everything
all: appjs
	echo $(DOCKER_PROJECT)

# Nuke du __dist, on repart de zéro.
clean:
	rm -rf $(CLIENT_DIST)/*

$(BUILD_DIST):
	mkdir -p $(BUILD_DIST)

# Pour un build de dev
appjs:
	esbuild $(FLAGS) --platform=node --sourcemap --outfile=$(BUILD_DIST)/zoe src/cli.ts
	chmod +x $(BUILD_DIST)/zoe
	esbuild $(FLAGS) --platform=node --sourcemap --outfile=$(BUILD_DIST)/server src/webserver/server.ts
	chmod +x $(BUILD_DIST)/server
	esbuild $(FLAGS) --platform=browser --sourcemap --outfile=$(BUILD_DIST)/client.js src/webclient/client.tsx
	echo app.js rebuilt.

generate:
	esr src/parser/ast/__mkaugments.ts

watch:
	make generate
	tsc --build -w | wtsc make -s appjs
