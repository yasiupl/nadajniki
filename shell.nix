{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    gnumake
    curl
    bash
    python3
  ];

  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
    export NODE_OPTIONS=--openssl-legacy-provider
    echo "Welcome to the Nadajniki dev shell!"
    node --version
  '';
}
