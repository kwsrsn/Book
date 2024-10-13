import streamlit as st
import requests

st.title("Streamlit App")

response = requests.get("http://localhost:5000/api/data")  # เรียกใช้ Flask API
data = response.json()

st.write(data)  # แสดงข้อมูลจาก Flask
