# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME=""

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-vi-mode)

source $ZSH/oh-my-zsh.sh
source ~/.config/zsh/muse-ansi.zsh-theme

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"

# Aliases
alias cya="shutdown -r 0"

# Shuts down, first offering to save the denteo session's worktree windows (sw)
# when that session is open and differs from what was last saved.
ade() {
  local saved=${NT_STATE_FILE:-$HOME/.local/state/nt/windows}
  if tmux has-session -t denteo 2>/dev/null &&
    [ "$(sw -s denteo -l)" != "$(cat $saved 2>/dev/null)" ] &&
    read -q "?Save work (sw) first? [y/N] "; then
    echo
    sw -s denteo || return
  fi
  echo
  shutdown 0
}

alias dotfiles="/usr/bin/git --git-dir=$HOME/.dotfiles --work-tree=$HOME" 
alias ppcassets="cd $HOME/Development/rust/warppcs/client/assets/" 
alias ppc="$HOME/Development/rust/warppcs/target/release/ppc_console"

# Add nvim to PATH
export PATH="$PATH:/opt/nvim/bin"

# Set editor
export EDITOR=nvim
export VISUAL=nvim

# pan do path
export PATH="$HOME/denteo/dental/script:$PATH"

# RTX version manager
eval "$(~/.local/bin/mise activate zsh)"

# mason path
export PATH="$HOME/.local/share/nvim/mason/bin:$PATH"

# scripts path
export PATH="$HOME/scripts:$PATH"

# yazi shell wrapper
function yy() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXX")"
	yazi "$@" --cwd-file="$tmp"
	if cwd="$(cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
		cd -- "$cwd"
	fi
	rm -f -- "$tmp"
}

# Machine-local config and secrets, not tracked in dotfiles
[ -f ~/.zshrc.local ] && source ~/.zshrc.local
