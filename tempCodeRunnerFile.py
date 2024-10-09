@app.route('/search', methods=['GET'])
# def search():
#     uid = session.get('uid')
#     namebook = db.reference('uploads/'+uid).get()
#     if not uid:
#         return jsonify({"error": "User not logged in"}), 401