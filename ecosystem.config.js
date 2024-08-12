module.exports = {
    apps: [
	{
    	"name"        : "sero",
    	"script"      : "build/index.js",
    	"ignoreWatch" : ["node_modules", "src", "data", "test", "tmp", "env"],
    	"watch"       : true,
    	"args"		: [
        		"--color"
   	 		]
	},
    ],
}
