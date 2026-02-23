{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.git
  ];
  
  env = {
    # Ensure pnpm is used for package management
    NPM_CONFIG_PREFIX = "$REPL_HOME/.local/npm";
    PATH = "$REPL_HOME/.local/npm/bin:$REPL_HOME/node_modules/.bin:$PATH";
  };
}