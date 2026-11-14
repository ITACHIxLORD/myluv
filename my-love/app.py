from flask import Flask, render_template, Response
import subprocess
import sys

app = Flask(name)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/heart")
def heart():
    process = subprocess.Popen(
        [sys.executable, "heart.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1
    )

    def generate():
        try:
            for line in process.stdout:
                yield f"data: {line.rstrip()}\n\n"
        finally:
            process.terminate()

    from flask import stream_with_context
    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream"
    )

if name == "main":
    app.run(host="0.0.0.0", port=10000)
