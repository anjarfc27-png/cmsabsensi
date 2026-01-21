"""
Face Recognition Service for cms absensi
Provides face enrollment and verification endpoints
Menggunakan face_recognition library (dlib) untuk akurasi maksimal
"""

import os
import io
import base64
import face_recognition
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
FACE_MATCH_THRESHOLD = 0.6  # Semakin rendah = semakin strict (default: 0.6)
FACE_DETECTION_MODEL = 'hog'  # 'hog' = fast, 'cnn' = accurate (butuh GPU)


def decode_base64_image(base64_string):
    """Decode base64 string to PIL Image"""
    try:
        # Remove data:image/jpeg;base64, prefix if exists
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        return np.array(image)
    except Exception as e:
        raise ValueError(f"Invalid base64 image: {str(e)}")


def get_face_encoding(image_array):
    """Extract face encoding from image array"""
    try:
        # Detect faces
        face_locations = face_recognition.face_locations(image_array, model=FACE_DETECTION_MODEL)
        
        if len(face_locations) == 0:
            return None, "No face detected in the image"
        
        if len(face_locations) > 1:
            return None, "Multiple faces detected. Please ensure only one face is visible"
        
        # Get face encoding
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        
        if len(face_encodings) == 0:
            return None, "Could not generate face encoding"
        
        return face_encodings[0], None
        
    except Exception as e:
        return None, f"Face processing error: {str(e)}"


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'face-recognition',
        'version': '1.0.0'
    })


@app.route('/enroll', methods=['POST'])
def enroll_face():
    """
    Enroll a new face
    Expected payload:
    {
        "image": "base64_encoded_image"
    }
    
    Returns:
    {
        "success": true,
        "encoding": [128-dimensional array],
        "message": "Face enrolled successfully"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image in request body'
            }), 400
        
        # Decode image
        image_array = decode_base64_image(data['image'])
        
        # Get face encoding
        encoding, error = get_face_encoding(image_array)
        
        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Convert numpy array to list for JSON serialization
        encoding_list = encoding.tolist()
        
        return jsonify({
            'success': True,
            'encoding': encoding_list,
            'message': 'Face enrolled successfully'
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500


@app.route('/verify', methods=['POST'])
def verify_face():
    """
    Verify a face against stored encoding
    Expected payload:
    {
        "image": "base64_encoded_image",
        "stored_encoding": [128-dimensional array]
    }
    
    Returns:
    {
        "success": true,
        "match": true/false,
        "distance": 0.35,
        "confidence": 0.85,
        "message": "Face verified successfully"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data or 'stored_encoding' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image or stored_encoding in request body'
            }), 400
        
        # Decode image
        image_array = decode_base64_image(data['image'])
        
        # Get face encoding from current image
        current_encoding, error = get_face_encoding(image_array)
        
        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Convert stored encoding to numpy array
        stored_encoding = np.array(data['stored_encoding'])
        
        # Calculate face distance (lower = more similar)
        # face_distance returns Euclidean distance
        distances = face_recognition.face_distance([stored_encoding], current_encoding)
        distance = float(distances[0])
        
        # Check if faces match
        is_match = distance < FACE_MATCH_THRESHOLD
        
        # Calculate confidence (inverse of distance, normalized to 0-1)
        # Distance 0 = 100% confidence, Distance 1 = 0% confidence
        confidence = max(0, min(1, 1 - distance))
        
        return jsonify({
            'success': True,
            'match': bool(is_match),
            'distance': round(distance, 4),
            'confidence': round(confidence * 100, 2),  # as percentage
            'threshold': FACE_MATCH_THRESHOLD,
            'message': 'Face verified successfully' if is_match else 'Face does not match'
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500


@app.route('/batch-verify', methods=['POST'])
def batch_verify():
    """
    Verify a face against multiple stored encodings (find best match)
    Expected payload:
    {
        "image": "base64_encoded_image",
        "encodings": [
            {"id": "user1", "encoding": [...]},
            {"id": "user2", "encoding": [...]}
        ]
    }
    
    Returns best match or no match
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data or 'encodings' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image or encodings in request body'
            }), 400
        
        # Decode image
        image_array = decode_base64_image(data['image'])
        
        # Get face encoding
        current_encoding, error = get_face_encoding(image_array)
        
        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Compare with all stored encodings
        best_match = None
        best_distance = float('inf')
        
        for item in data['encodings']:
            stored_encoding = np.array(item['encoding'])
            distances = face_recognition.face_distance([stored_encoding], current_encoding)
            distance = float(distances[0])
            
            if distance < best_distance:
                best_distance = distance
                best_match = {
                    'id': item['id'],
                    'distance': distance,
                    'confidence': max(0, min(1, 1 - distance)) * 100
                }
        
        if best_match and best_distance < FACE_MATCH_THRESHOLD:
            return jsonify({
                'success': True,
                'match_found': True,
                'best_match': best_match,
                'message': f'Matched with user {best_match["id"]}'
            })
        else:
            return jsonify({
                'success': True,
                'match_found': False,
                'message': 'No matching face found'
            })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"🚀 Face Recognition Service starting on port {port}")
    print(f"📊 Match Threshold: {FACE_MATCH_THRESHOLD}")
    print(f"🔍 Detection Model: {FACE_DETECTION_MODEL}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
