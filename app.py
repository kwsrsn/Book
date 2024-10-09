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
import tempfile

app = Flask(__name__)
rf = Roboflow(api_key="GjIhJ9A525bYsGiVQIRA")
project = rf.workspace("kwsr").project("book-gtby9")
model = project.version(2).model


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


            img.thumbnail((600, 800))  # Resize to 800x800
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
                text = reader.readtext(np.array(image_crop), detail=0,paragraph =True)
                ocr_result = " ".join(text)
                logging.debug(f"OCR result: {ocr_result}")

                # Delete the temporary file after processing
                os.remove(temp_file_path)
                
                data = {
                    'image_url': image_url,
                    'namebook': ocr_result,
                    'timestamp': firestore.SERVER_TIMESTAMP  # Save current timestamp
                }
                db.collection('uploads').document(uid).collection('book').add(data)
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
    
    
@app.route('/search', methods=['POST'])
def search_page():
    if 'file' not in request.files:
        logging.error("No file uploaded")  # Log when no file is uploaded
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    uid = session.get('uid')
    if file.filename == '':
        logging.error("No selected file")
        return jsonify({"error": "No selected file"}), 400
    
    # Log file information
    logging.debug(f"Uploaded file: {file.filename}, type: {file.content_type}")
    
    # Process the uploaded file directly
    response = process_file(file, uid)

    if isinstance(response, tuple) and isinstance(response[0], dict):
        # If response is an error response
        return response  # Return the error response

    # Assuming that response contains titles and images
    titles, images = response
    session['titles'] = titles
    session['images'] = images

    return jsonify({"titles": titles, "images": images})  # Return titles and images as JSON

@app.route('/results')
def results():
    titles = session.get('titles', [])
    images = session.get('images', [])

    # Log the titles and images for debugging
    logging.debug(f"Titles: {titles}, Images: {images}")

    # Ensure both titles and images have values
    if not titles or not images:
        logging.warning("No titles or images found in session.")
        return render_template('result.html', titles=[], images=[])

    # Prepare a list of tuples for titles and images
    combined_results = list(zip(titles, images))

    return render_template('result.html', combined_results=combined_results)

def process_file(file, uid):
    temp_file = None  # Initialize temp_file
    try:
        # Create a temporary file to save the uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
            file.save(temp_file.name)
            logging.debug(f"Temporary file created at: {temp_file.name}")

            img = PILImage.open(temp_file.name)
            img.thumbnail((600, 800))  # Resize the image
            img.save(temp_file.name, format='PNG', optimize=True)  # Save with compression
            
            # Call the Roboflow API to get predictions
            result = model.predict(temp_file.name, confidence=40, overlap=30).json()
            logging.debug(f"Roboflow prediction: {result}")

            if result.get('predictions'):
                prediction = result['predictions'][0]
                left = prediction['x'] - (prediction['width'] / 2)
                top = prediction['y'] - (prediction['height'] / 2)
                right = prediction['x'] + (prediction['width'] / 2)
                bottom = prediction['y'] + (prediction['height'] / 2)

                img = PILImage.open(temp_file.name)
                image_crop = img.crop((left, top, right, bottom)).convert('L')
                logging.debug("Image cropped successfully")

                # Use EasyOCR to read text from the cropped image
                reader = easyocr.Reader(['th', 'en'])
                text = reader.readtext(np.array(image_crop), detail=0, paragraph=True)
                ocr_result = " ".join(text).strip()  # Join the text
                logging.debug(f"OCR result: {ocr_result}")

                # Check if the book title exists in Firestore
                book_titles_with_ids = check_book_title_in_firestore(uid, ocr_result)
                if book_titles_with_ids:
                    logging.debug(f"Book titles found: {book_titles_with_ids}")

                    # Fetch book cover images from Firestore
                    book_images = fetch_book_images(uid, book_titles_with_ids)

                    # Extract only the titles for the response
                    book_titles = [title for title, _ in book_titles_with_ids]

                    return book_titles, book_images  # Return titles and images
            
            logging.error("No predictions found.")
            return [], []  # Return empty if no predictions found
    except Exception as e:
        logging.error(f"Error processing file: {str(e)}")
        return jsonify({"error": f"Error processing the file: {str(e)}"}), 500
    finally:
        # Remove the temporary file after processing
        if temp_file and os.path.exists(temp_file.name):
            os.remove(temp_file.name)
            logging.debug(f"Temporary file deleted: {temp_file.name}")

def check_book_title_in_firestore(uid, ocr_result):
    field_name = 'namebook'  # Field name to check
    try:
        docs = db.collection('uploads').document(uid).collection('book').where(field_name, '==', ocr_result).stream()
        titles_with_ids = [(doc.to_dict().get(field_name), doc.id) for doc in docs]  # Returns a list of tuples (namebook, document ID)
        return titles_with_ids  # Return found titles with IDs
    except Exception as e:
        logging.error(f"Error querying Firestore: {str(e)}")
        return []  # Return an empty list on error

def fetch_book_images(uid, book_titles_with_ids):
    book_images = []
    for title, doc_id in book_titles_with_ids:
        try:
            doc = db.collection('uploads').document(uid).collection('book').document(doc_id).get()
            if doc.exists:
                data = doc.to_dict()
                book_image_url = data.get('image_url')  # Get the image URL
                if book_image_url:
                    book_images.append(book_image_url)  # Append the image URL to the list
        except Exception as e:
            logging.error(f"Error fetching book image for {title}: {str(e)}")
    return book_images  # Return the list of image URLs

if __name__ == '__main__':
    app.run(debug=True)

