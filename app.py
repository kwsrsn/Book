from flask import Flask, request, render_template, render_template_string, redirect, url_for, jsonify, session
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
from werkzeug.utils import secure_filename
import os
import logging
import easyocr
from IPython.display import display, Image
import json
import requests
from roboflow import Roboflow
import numpy as np
from PIL import Image as PILImage, ExifTags
import easyocr

app = Flask(__name__)


# ตั้งค่าการ logging
logging.basicConfig(level=logging.DEBUG)

# Path to your service account key file
cred = credentials.Certificate("bookai-7cf88-firebase-adminsdk-a4x7v-0b958e4360.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'bookai-7cf88.appspot.com'
})
db = firestore.client()
app.secret_key = os.urandom(24)  # Set a random secret key for session management

@app.route('/')
def index():
    return render_template('login2.html')

@app.route('/mybook')
def mybook():
    return render_template('mybook.html')

@app.route('/addbook')
def add():
    return render_template('addbook.html')

@app.route('/search')
def search():
    return render_template('home-search.html')

@app.route('/logout')
def logout():
    session.pop('uid', None)  # Clear the UID from the session
    return redirect(url_for('index'))

@app.route('/register', methods=['POST'])
def register():
    username = request.form['user']
    email = request.form['email']
    password = request.form['password']
    
    try:
        user = auth.create_user(
            email=email,
            password=password
        )
        
        doc_ref = db.collection('users').document(user.uid)
        doc_ref.set({
            'username': username,
            'email': email,
            'uid': user.uid,
            'password': password,  # Consider removing password storage for security
        })

        return render_template_string('''
            <script>
                alert("Registration successful!");
                window.location.href = document.referrer;  // Return to the previous page
            </script>
        ''')
    
    except Exception as e:
        return f"An error occurred: {e}"
    
@app.route('/login', methods=['POST'])
def login():
    email = request.form['email']
    password = request.form['password']
    
    try:
        user_query = db.collection('users').where('email', '==', email).get() 
        if user_query:
            user_doc = user_query[0]
            user_data = user_doc.to_dict()
            if user_data['password'] == password: 
                session['uid'] = user_data['uid']  # Store UID in session
                return render_template_string('''
                    <script>
                        alert("Login successful!");
                        window.location.href = "/mybook";  // Redirect to mybook page
                    </script>
                ''')
            else:
                return render_template_string('''    
                    <script>
                        alert("Login failed: Incorrect password!");
                        window.location.href = document.referrer;  // Return to previous page
                    </script>
                ''')
        else:
            return render_template_string('''
                <script>
                    alert("Login failed: User not found!");
                    window.location.href = document.referrer;  // Return to previous page
                </script>
            ''')
    except Exception as e:
        return render_template_string(f'''
            <script>
                alert("Login failed: {e}");
                window.location.href = document.referrer;
            </script>
        ''')

    
@app.route('/upload', methods=['POST'])
def upload():
    rf = Roboflow(api_key="GjIhJ9A525bYsGiVQIRA")
    project = rf.workspace("kwsr").project("book-gtby9")
    model = project.version(2).model
    logging.debug("Starting upload function")
    uid = session.get('uid')  # Get UID from session
    if not uid:
        logging.error("User not logged in")
        return jsonify({"error": "User not logged in"}), 401

    file = request.files.get('file')
    if file:
        try:
            # Check file size (example: 5 MB limit)
            if file.content_length > 5 * 1024 * 1024:
                logging.error("File size exceeds limit of 5 MB")
                return jsonify({"error": "File size exceeds limit of 5 MB"}), 413

            # Resize and correct orientation of the image
            img = PILImage.open(file)

            try:
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation] == 'Orientation':
                        break
                exif = img._getexif()
                if exif is not None:
                    orientation_value = exif.get(orientation)
                    if orientation_value == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation_value == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation_value == 8:
                        img = img.rotate(90, expand=True)
            except Exception as e:
                logging.error(f"Error reading EXIF data: {e}")


            img.thumbnail((300, 400))  # Resize to 800x800
            temp_file_path = f"./{secure_filename(file.filename)}"
            img.save(temp_file_path)  # Save the resized image temporarily

            # Save file to Firebase Storage
            filename = secure_filename(file.filename)
            logging.debug(f"File to upload: {filename}")
            blob = storage.bucket().blob(f"{uid}/{filename}")
            blob.upload_from_filename(temp_file_path, content_type=file.content_type)
            logging.debug("File uploaded successfully")

            # Get the public URL of the uploaded file
            image_url = blob.public_url

            # Run Roboflow model to detect book and get bounding box
            result = model.predict(temp_file_path, confidence=40, overlap=30).json()
            logging.debug(f"Roboflow prediction: {result}")

            if result.get('predictions'):
                prediction = result['predictions'][0]
                left = prediction['x'] - (prediction['width'] / 2)
                top = prediction['y'] - (prediction['height'] / 2)
                right = prediction['x'] + (prediction['width'] / 2)
                bottom = prediction['y'] + (prediction['height'] / 2)

                # Crop the detected book area from the image
                img = PILImage.open(temp_file_path)
                image_crop = img.crop((left, top, right, bottom)).convert('L')
                logging.debug("Image cropped successfully")

                # Use EasyOCR to read text from the cropped image
                reader = easyocr.Reader(['th', 'en'])
                ocr_result = reader.readtext(np.array(image_crop), detail=0,paragraph =True)
                logging.debug(f"OCR result: {ocr_result}")

                # Delete the temporary file after processing
                os.remove(temp_file_path)
                
                data = {
                    'user_id': uid,
                    'image_url': image_url,
                    'ocr_result': ocr_result,
                    'timestamp': firestore.SERVER_TIMESTAMP  # Save current timestamp
                }
                db.collection('uploads').add(data)
                logging.debug("Data saved to Firestore")

                # Return success response with OCR result and the image URL
                return jsonify({
                    "message": "File uploaded and processed successfully!",
                    "ocr_result": ocr_result,
                    "image_url": image_url
                }), 200
            else:
                logging.error("No book detected in the image!")
                return jsonify({"error": "No book detected in the image!"}), 400

        except Exception as e:
            logging.error(f"Upload failed: {str(e)}")
            return jsonify({"error": f"Upload failed: {str(e)}"}), 500
    else:
        logging.error("No file uploaded")
        return jsonify({"error": "No file uploaded"}), 400

@app.route('/images', methods=['GET'])
def get_images():
    uid = session.get('uid')  # Get UID from session
    if not uid:
        return jsonify({"error": "User not logged in"}), 401

    bucket = storage.bucket()  # Reference to the bucket
    prefix = f"{uid}/"  # User-specific folder in storage

    try:
        # List blobs with the specified prefix
        blobs = bucket.list_blobs(prefix=prefix)
        urls = []

        for blob in blobs:
            blob.make_public()  # Make the blob public before fetching the URL
            url = blob.public_url  # Get the public URL for the blob
            urls.append(url)

        return jsonify(urls), 200  # Return list of image URLs as JSON
    except Exception as e:
        logging.error(f"Error fetching images: {str(e)}")  # Log the error
        return jsonify({"error": f"Error fetching images: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)

