## MyImHost

Simple self-hosted file hosting web site with base auth (for upload only) driven by Node.JS

### Usage

#### install and run

Please check file `.example.env` before start server, there are important variables 

```bash
git clone https://github.com/myimhost/myimhost.git
cd myimhost
cp .example.env .env
# Edit .env to your preference
npm run start
```

#### Web interface

**Upload screen:**

Here you can drag-n-drop file from PC, paste it from clipboard or choose in explorer by clicking "Choose images" button.

**File preview:**

Here you can specify some parameters for uploaded file:

* "**folder**" - subfolder where your file will placed (depth is limited to 1 for now)

* "**name**" - name for uploading file. if empty then random name of 5 chars will be generated like "Ag9b4.jpg"

* "**Don't use extension**" - if not checked: when name empty, or extension suffix is not provided in name, extension suffix will be determined depending on the file type. if checked file name will have no extension suffix

* "**Post**" - upload file to server

* "**To base64 url**" - encode file into base64 and get data URL ([Data URLs - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs))

#### HTTP Api

**Auth**: if enabled, `POST /upload` require a base auth authentication

`POST /upload` accepts `multipart/form-data` with:

* `file` - file blob

* `name` - name string. Optional

* `folder` - folder string. Optional

* `dont-use-ext` - non empty string for specify to not use extension suffix. Optional

If status 200, then returns relative path to uploaded file, otherwise error message will returned

Python example:

```python
import requests
f = open(r'file.png', 'rb')
formdata = {'file': f, 'name': (None, 'myimage'), 'folder': (None, 'myfiles'), 'dont-use-ext': (None, "On")}
res = requests.post('http://localhost:8080/upload', files=formdata, auth=('myuser', 'mypass'))
print(res.status_code, res.text)
```

#### Access files

Uploaded files accessed by `/*filename*` or `/*folder*/*filename*` path

### Screenshots

**Upload screen:**

<img title="" src="https://i.imgur.com/DaP7DiY.png" alt="" width="688" data-align="center">

**File preview:**

<img title="" src="https://i.imgur.com/ro4JYww.png" alt="" data-align="center" width="696">

### Credits

Upload button was taken from another image-hosting project [GitHub - gechandesu/imgs: Simple image hosting webapp](https://github.com/gechandesu/imgs)
