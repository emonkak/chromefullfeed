# -*- ruby -*-
require 'rubygems'
require 'crxmake'
require 'fileutils'
include FileUtils::Verbose
$manifest = "src/manifest.json"

module Utils
  class Version < Object
    def initialize version
      @major, @minor, @patch = version.split('.').map{|n| n.to_i }
    end
    def to_s
      [@major, @minor, @patch].join('.')
    end
    def inc_major
      @major+=1
      @minor=0
      @patch=0
      return self
    end
    def inc_minor
      @minor+=1
      @patch=0
      return self
    end
    def inc_patch
      @patch+=1
      return self
    end
    def inc arg
      __send__("inc_" + arg)
    end
  end

  def version_up arg
    m = manifest_load
    pre = m["version"]
    m["version"] = Version.new(m["version"]).inc(arg).to_s
    puts "up from #{pre} to #{m["version"]}"
    manifest_save(m)
  end

  def manifest_load
    File.open($manifest, 'rb'){|f| JSON.parse(f.read)}
  end

  def manifest_save m
    File.open($manifest, 'wb'){|f| f << JSON.pretty_generate(m)}
  end

  module_function :version_up, :manifest_load, :manifest_save
end

# version task
desc "display current version"
task :version do
  puts Utils.manifest_load["version"]
end

namespace :version do
  desc "major version up"
  task :major do
    Utils.version_up "major"
  end

  desc "minor version up"
  task :minor do
    Utils.version_up "minor"
  end

  desc "patch version up"
  task :patch do
    Utils.version_up "patch"
  end
end

# package task
desc "package"
task :package do
  mkdir_p "package" unless File.exist?("package")
  package = "package/chromefullfeed.crx"
  rm package if File.exist?(package)
  CrxMake.make(
    :ex_dir => "src",
    :pkey   => "~/dev/private/chromefullfeed.pem",
    :crx_output => "package/chromefullfeed.crx",
    :verbose => true,
    :ignorefile => /\.swp/,
    :ignoredir => /\.(?:svn|git|cvs)/
  )
end

directory "package"

# vim: syntax=ruby
