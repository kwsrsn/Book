from flask import Flask, request, render_template, redirect, url_for, jsonify
from werkzeug.utils import secure_filename
import logging
import easyocr
from roboflow import Roboflow
import numpy as np
from PIL import Image as PILImage, ExifTags
import os

app = Flask(__name__)
rf = Roboflow(api_key="GjIhJ9A525bYsGiVQIRA")
project = rf.workspace("kwsr").project("book-gtby9")
model = project.version(6).model

# Set up logging
logging.basicConfig(level=logging.DEBUG)

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
    return redirect(url_for('index'))

@app.route('/results')
def results():
    titles = request.args.get('titles')
    images = request.args.get('images')

    if not titles or not images:
        return render_template('result.html', combined_results=[])

    # Decode the data from the URL
    import json
    titles = json.loads(titles)
    images = json.loads(images)

    combined_results = zip(titles, images)

    return render_template('result.html', combined_results=combined_results)

@app.route('/process-image', methods=['POST'])
def process_image():
    try:
        file = request.files.get('file')
        logging.debug(file)

        if not file:
            return jsonify({'error': 'No file provided'}), 400

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
        img.save(temp_file_path)  # บันทึกไฟล์ชั่วคราวลงในเซิร์ฟเวอร์

        result = model.predict(temp_file_path, confidence=40, overlap=30).json()
        logging.debug(f"Roboflow result: {result}")

        if result.get('predictions'):
            prediction = result['predictions'][0]
            left = prediction['x'] - (prediction['width'] / 2)
            top = prediction['y'] - (prediction['height'] / 2)
            right = prediction['x'] + (prediction['width'] / 2)
            bottom = prediction['y'] + (prediction['height'] / 2)

            image_crop = img.crop((left, top, right, bottom)).convert('L')
            logging.debug("Image cropped successfully")

            # OCR การอ่านข้อความจากภาพที่ถูกครอป
            reader = easyocr.Reader(['th', 'en'])
            text = reader.readtext(np.array(image_crop), detail=0, paragraph=True)
            ocr_result = " ".join(text).strip()
            logging.debug(f"OCR result: {ocr_result}")

            os.remove(temp_file_path)
            return jsonify({'ocr_result': ocr_result}), 200
        else:
            os.remove(temp_file_path)
            logging.error("No predictions made by Roboflow")
            return jsonify({'error': 'No predictions made by Roboflow'}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
