import os
import uuid
import json
from datetime import datetime, timezone
from functools import wraps

from flask import (Flask, render_template, request, redirect, url_for,
                   session, jsonify, send_from_directory)
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'echox-super-secret-key-change-in-prod')

basedir = os.path.abspath(os.path.dirname(__file__))

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'sqlite:///' + os.path.join(basedir, 'echox.db') # Ye file root folder me banegi
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp',
                      'mp4', 'mov', 'avi', 'webm',
                      'pdf', 'doc', 'docx', 'xls', 'xlsx',
                      'txt', 'zip', 'rar', '7z', 'mp3', 'wav'}

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')

# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    bio = db.Column(db.Text, default='')
    avatar = db.Column(db.String(256), default='')
    is_online = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy=True, cascade='all, delete-orphan')
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy=True)
    pulses = db.relationship('Pulse', backref='user', lazy=True, cascade='all, delete-orphan')
    group_memberships = db.relationship('GroupMember', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'bio': self.bio or '',
            'avatar': self.avatar or '',
            'is_online': self.is_online,
            'created_at': self.created_at.isoformat()
        }


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=True)
    content = db.Column(db.Text, default='')
    file_url = db.Column(db.String(512), default='')
    file_type = db.Column(db.String(50), default='')
    file_name = db.Column(db.String(256), default='')
    is_delivered = db.Column(db.Boolean, default=False)
    is_seen = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'group_id': self.group_id,
            'content': self.content or '',
            'file_url': self.file_url or '',
            'file_type': self.file_type or '',
            'file_name': self.file_name or '',
            'is_delivered': self.is_delivered,
            'is_seen': self.is_seen,
            'created_at': self.created_at.isoformat(),
            'sender_username': self.sender.username if self.sender else '',
            'sender_avatar': self.sender.avatar if self.sender else ''
        }


class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    photo = db.Column(db.String(256), default='')
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship('GroupMember', backref='group', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='group', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description or '',
            'photo': self.photo or '',
            'admin_id': self.admin_id,
            'created_at': self.created_at.isoformat(),
            'member_count': len(self.members)
        }


class GroupMember(db.Model):
    __tablename__ = 'group_members'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)


class Pulse(db.Model):
    __tablename__ = 'pulses'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content = db.Column(db.Text, default='')
    media_url = db.Column(db.String(512), default='')
    media_type = db.Column(db.String(50), default='text')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'content': self.content or '',
            'media_url': self.media_url or '',
            'media_type': self.media_type or 'text',
            'created_at': self.created_at.isoformat(),
            'username': self.user.username if self.user else '',
            'user_avatar': self.user.avatar if self.user else ''
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_file(file, subfolder):
    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'bin'
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    folder = os.path.join(app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, unique_name)
    file.save(path)
    return f"/static/uploads/{subfolder}/{unique_name}", ext


def get_file_type(ext):
    if ext in {'png', 'jpg', 'jpeg', 'gif', 'webp'}:
        return 'image'
    if ext in {'mp4', 'mov', 'avi', 'webm'}:
        return 'video'
    if ext in {'mp3', 'wav', 'ogg'}:
        return 'audio'
    return 'file'


# ---------------------------------------------------------------------------
# Auth Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() or request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            user.is_online = True
            db.session.commit()
            if request.is_json:
                return jsonify({'success': True, 'redirect': url_for('dashboard')})
            return redirect(url_for('dashboard'))

        if request.is_json:
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
        return render_template('login.html', error='Invalid email or password')

    return render_template('login.html')


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data = request.get_json() or request.form
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not username or not email or not password:
            msg = 'All fields are required'
            if request.is_json:
                return jsonify({'success': False, 'error': msg}), 400
            return render_template('signup.html', error=msg)

        if User.query.filter_by(username=username).first():
            msg = 'Username already taken'
            if request.is_json:
                return jsonify({'success': False, 'error': msg}), 400
            return render_template('signup.html', error=msg)

        if User.query.filter_by(email=email).first():
            msg = 'Email already registered'
            if request.is_json:
                return jsonify({'success': False, 'error': msg}), 400
            return render_template('signup.html', error=msg)

        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()

        session['user_id'] = user.id
        user.is_online = True
        db.session.commit()

        if request.is_json:
            return jsonify({'success': True, 'redirect': url_for('dashboard')})
        return redirect(url_for('dashboard'))

    return render_template('signup.html')


@app.route('/logout')
@login_required
def logout():
    user = User.query.get(session['user_id'])
    if user:
        user.is_online = False
        db.session.commit()
    session.clear()
    return redirect(url_for('login'))


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.route('/dashboard')
@login_required
def dashboard():
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user)


@app.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    uid = session['user_id']
    total_chats = db.session.query(Message.receiver_id).filter(
        ((Message.sender_id == uid) | (Message.receiver_id == uid)) &
        (Message.group_id.is_(None))
    ).distinct().count()

    total_groups = GroupMember.query.filter_by(user_id=uid).count()
    total_pulses = Pulse.query.filter_by(user_id=uid).count()

    return jsonify({
        'total_chats': total_chats,
        'total_groups': total_groups,
        'total_pulses': total_pulses
    })


@app.route('/api/profile/update', methods=['POST'])
@login_required
def update_profile():
    user = User.query.get(session['user_id'])
    data = request.form

    if 'username' in data:
        new_username = data['username'].strip()
        if new_username != user.username:
            if User.query.filter_by(username=new_username).first():
                return jsonify({'success': False, 'error': 'Username taken'}), 400
            user.username = new_username

    if 'bio' in data:
        user.bio = data['bio']

    if 'avatar' in request.files:
        f = request.files['avatar']
        if f and allowed_file(f.filename):
            url, _ = save_file(f, 'avatars')
            user.avatar = url

    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()})


@app.route('/api/profile/change-password', methods=['POST'])
@login_required
def change_password():
    user = User.query.get(session['user_id'])
    data = request.get_json()
    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    if not check_password_hash(user.password_hash, old_pw):
        return jsonify({'success': False, 'error': 'Current password is incorrect'}), 400

    user.password_hash = generate_password_hash(new_pw)
    db.session.commit()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# Delete Account
# ---------------------------------------------------------------------------

@app.route('/delete-account', methods=['GET'])
@login_required
def delete_account_page():
    return render_template('delete_account.html')


@app.route('/api/delete-account', methods=['POST'])
@login_required
def delete_account():
    user = User.query.get(session['user_id'])
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if email != user.email:
        return jsonify({'success': False, 'error': 'Email does not match'}), 400

    if not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'error': 'Password is incorrect'}), 400

    # Delete messages sent to this user (received)
    Message.query.filter_by(receiver_id=user.id).delete()
    db.session.delete(user)
    db.session.commit()
    session.clear()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# Users API
# ---------------------------------------------------------------------------

@app.route('/api/users/search')
@login_required
def search_users():
    q = request.args.get('q', '').strip()
    uid = session['user_id']
    if not q:
        users = User.query.filter(User.id != uid).limit(20).all()
    else:
        users = User.query.filter(
            User.id != uid,
            User.username.ilike(f'%{q}%')
        ).limit(20).all()
    return jsonify([u.to_dict() for u in users])


@app.route('/api/users/<int:user_id>')
@login_required
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@app.route('/api/me')
@login_required
def get_me():
    user = User.query.get(session['user_id'])
    return jsonify(user.to_dict())


# ---------------------------------------------------------------------------
# Chat Routes
# ---------------------------------------------------------------------------

@app.route('/chat')
@login_required
def chat_page():
    user = User.query.get(session['user_id'])
    return render_template('chat.html', user=user)


@app.route('/api/chat/conversations')
@login_required
def get_conversations():
    uid = session['user_id']
    # Get unique conversation partners
    sent = db.session.query(Message.receiver_id).filter(
        Message.sender_id == uid, Message.group_id.is_(None), Message.receiver_id.isnot(None)
    ).distinct()
    received = db.session.query(Message.sender_id).filter(
        Message.receiver_id == uid, Message.group_id.is_(None)
    ).distinct()

    partner_ids = set()
    for row in sent:
        partner_ids.add(row[0])
    for row in received:
        partner_ids.add(row[0])

    result = []
    for pid in partner_ids:
        partner = User.query.get(pid)
        if not partner:
            continue
        last_msg = Message.query.filter(
            ((Message.sender_id == uid) & (Message.receiver_id == pid)) |
            ((Message.sender_id == pid) & (Message.receiver_id == uid))
        ).order_by(Message.created_at.desc()).first()
        unread = Message.query.filter_by(sender_id=pid, receiver_id=uid, is_seen=False).count()
        result.append({
            'user': partner.to_dict(),
            'last_message': last_msg.to_dict() if last_msg else None,
            'unread': unread
        })

    result.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else '', reverse=True)
    return jsonify(result)


@app.route('/api/chat/messages/<int:other_id>')
@login_required
def get_messages(other_id):
    uid = session['user_id']
    msgs = Message.query.filter(
        ((Message.sender_id == uid) & (Message.receiver_id == other_id)) |
        ((Message.sender_id == other_id) & (Message.receiver_id == uid))
    ).order_by(Message.created_at.asc()).all()

    # Mark as seen
    Message.query.filter_by(sender_id=other_id, receiver_id=uid, is_seen=False).update({'is_seen': True})
    db.session.commit()

    return jsonify([m.to_dict() for m in msgs])


@app.route('/api/chat/send', methods=['POST'])
@login_required
def send_message():
    uid = session['user_id']
    content = request.form.get('content', '')
    receiver_id = request.form.get('receiver_id')
    group_id = request.form.get('group_id')

    file_url = ''
    file_type = ''
    file_name_orig = ''

    if 'file' in request.files:
        f = request.files['file']
        if f and allowed_file(f.filename):
            file_name_orig = f.filename
            url, ext = save_file(f, 'files')
            file_url = url
            file_type = get_file_type(ext)

    msg = Message(
        sender_id=uid,
        receiver_id=int(receiver_id) if receiver_id else None,
        group_id=int(group_id) if group_id else None,
        content=content,
        file_url=file_url,
        file_type=file_type,
        file_name=file_name_orig,
        is_delivered=True
    )
    db.session.add(msg)
    db.session.commit()

    msg_dict = msg.to_dict()

    if receiver_id:
        room = f"dm_{min(uid, int(receiver_id))}_{max(uid, int(receiver_id))}"
        socketio.emit('new_message', msg_dict, room=room)
    elif group_id:
        socketio.emit('new_group_message', msg_dict, room=f"group_{group_id}")

    return jsonify({'success': True, 'message': msg_dict})


# ---------------------------------------------------------------------------
# Group Routes
# ---------------------------------------------------------------------------

@app.route('/groups')
@login_required
def groups_page():
    user = User.query.get(session['user_id'])
    return render_template('group.html', user=user)


@app.route('/api/groups', methods=['GET'])
@login_required
def get_groups():
    uid = session['user_id']
    memberships = GroupMember.query.filter_by(user_id=uid).all()
    groups = []
    for m in memberships:
        g = m.group
        if g:
            d = g.to_dict()
            last_msg = Message.query.filter_by(group_id=g.id).order_by(Message.created_at.desc()).first()
            d['last_message'] = last_msg.to_dict() if last_msg else None
            groups.append(d)
    return jsonify(groups)


@app.route('/api/groups/create', methods=['POST'])
@login_required
def create_group():
    uid = session['user_id']
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '')
    member_ids = json.loads(request.form.get('member_ids', '[]'))

    if not name:
        return jsonify({'success': False, 'error': 'Group name required'}), 400

    photo = ''
    if 'photo' in request.files:
        f = request.files['photo']
        if f and allowed_file(f.filename):
            photo, _ = save_file(f, 'groups')

    group = Group(name=name, description=description, photo=photo, admin_id=uid)
    db.session.add(group)
    db.session.flush()

    # Add admin
    db.session.add(GroupMember(group_id=group.id, user_id=uid))

    # Add members
    for mid in member_ids:
        if int(mid) != uid:
            db.session.add(GroupMember(group_id=group.id, user_id=int(mid)))

    db.session.commit()
    return jsonify({'success': True, 'group': group.to_dict()})


@app.route('/api/groups/<int:group_id>', methods=['GET'])
@login_required
def get_group(group_id):
    uid = session['user_id']
    group = Group.query.get_or_404(group_id)
    # Check membership
    if not GroupMember.query.filter_by(group_id=group_id, user_id=uid).first():
        return jsonify({'error': 'Not a member'}), 403

    members = []
    for m in group.members:
        u = User.query.get(m.user_id)
        if u:
            members.append(u.to_dict())

    d = group.to_dict()
    d['members'] = members
    d['is_admin'] = group.admin_id == uid
    return jsonify(d)


@app.route('/api/groups/<int:group_id>/messages', methods=['GET'])
@login_required
def get_group_messages(group_id):
    uid = session['user_id']
    if not GroupMember.query.filter_by(group_id=group_id, user_id=uid).first():
        return jsonify({'error': 'Not a member'}), 403
    msgs = Message.query.filter_by(group_id=group_id).order_by(Message.created_at.asc()).all()
    return jsonify([m.to_dict() for m in msgs])


@app.route('/api/groups/<int:group_id>/members/add', methods=['POST'])
@login_required
def add_group_member(group_id):
    uid = session['user_id']
    group = Group.query.get_or_404(group_id)
    if group.admin_id != uid:
        return jsonify({'error': 'Only admin can add members'}), 403
    data = request.get_json()
    user_id = data.get('user_id')
    if not GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first():
        db.session.add(GroupMember(group_id=group_id, user_id=user_id))
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>/members/remove', methods=['POST'])
@login_required
def remove_group_member(group_id):
    uid = session['user_id']
    group = Group.query.get_or_404(group_id)
    if group.admin_id != uid:
        return jsonify({'error': 'Only admin can remove members'}), 403
    data = request.get_json()
    user_id = data.get('user_id')
    GroupMember.query.filter_by(group_id=group_id, user_id=user_id).delete()
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>/leave', methods=['POST'])
@login_required
def leave_group(group_id):
    uid = session['user_id']
    GroupMember.query.filter_by(group_id=group_id, user_id=uid).delete()
    db.session.commit()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# Pulse Routes
# ---------------------------------------------------------------------------

@app.route('/pulse')
@login_required
def pulse_page():
    user = User.query.get(session['user_id'])
    return render_template('pulse.html', user=user)


@app.route('/api/pulses', methods=['GET'])
@login_required
def get_pulses():
    uid = session['user_id']
    # Get pulses from user and their contacts
    pulses = Pulse.query.order_by(Pulse.created_at.desc()).limit(50).all()
    return jsonify([p.to_dict() for p in pulses])


@app.route('/api/pulses/my', methods=['GET'])
@login_required
def get_my_pulses():
    uid = session['user_id']
    pulses = Pulse.query.filter_by(user_id=uid).order_by(Pulse.created_at.desc()).all()
    return jsonify([p.to_dict() for p in pulses])


@app.route('/api/pulses/create', methods=['POST'])
@login_required
def create_pulse():
    uid = session['user_id']
    content = request.form.get('content', '')
    media_url = ''
    media_type = 'text'

    if 'media' in request.files:
        f = request.files['media']
        if f and allowed_file(f.filename):
            url, ext = save_file(f, 'pulses')
            media_url = url
            media_type = get_file_type(ext)

    pulse = Pulse(user_id=uid, content=content, media_url=media_url, media_type=media_type)
    db.session.add(pulse)
    db.session.commit()

    socketio.emit('new_pulse', pulse.to_dict(), broadcast=True)
    return jsonify({'success': True, 'pulse': pulse.to_dict()})


@app.route('/api/pulses/<int:pulse_id>', methods=['DELETE'])
@login_required
def delete_pulse(pulse_id):
    uid = session['user_id']
    pulse = Pulse.query.get_or_404(pulse_id)
    if pulse.user_id != uid:
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(pulse)
    db.session.commit()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# SocketIO Events
# ---------------------------------------------------------------------------

@socketio.on('connect')
def on_connect():
    if 'user_id' in session:
        uid = session['user_id']
        user = User.query.get(uid)
        if user:
            user.is_online = True
            db.session.commit()
            join_room(f"user_{uid}")
            emit('user_online', {'user_id': uid}, broadcast=True)


@socketio.on('disconnect')
def on_disconnect():
    if 'user_id' in session:
        uid = session['user_id']
        user = User.query.get(uid)
        if user:
            user.is_online = False
            db.session.commit()
            emit('user_offline', {'user_id': uid}, broadcast=True)


@socketio.on('join_dm')
def join_dm(data):
    uid = session.get('user_id')
    other_id = data.get('other_id')
    if uid and other_id:
        room = f"dm_{min(uid, other_id)}_{max(uid, other_id)}"
        join_room(room)


@socketio.on('leave_dm')
def leave_dm(data):
    uid = session.get('user_id')
    other_id = data.get('other_id')
    if uid and other_id:
        room = f"dm_{min(uid, other_id)}_{max(uid, other_id)}"
        leave_room(room)


@socketio.on('join_group')
def join_group_room(data):
    uid = session.get('user_id')
    group_id = data.get('group_id')
    if uid and group_id:
        if GroupMember.query.filter_by(group_id=group_id, user_id=uid).first():
            join_room(f"group_{group_id}")


@socketio.on('leave_group')
def leave_group_room(data):
    group_id = data.get('group_id')
    if group_id:
        leave_room(f"group_{group_id}")


@socketio.on('typing')
def on_typing(data):
    uid = session.get('user_id')
    other_id = data.get('other_id')
    if uid and other_id:
        room = f"dm_{min(uid, other_id)}_{max(uid, other_id)}"
        user = User.query.get(uid)
        emit('user_typing', {'user_id': uid, 'username': user.username if user else ''}, room=room, include_self=False)


@socketio.on('stop_typing')
def on_stop_typing(data):
    uid = session.get('user_id')
    other_id = data.get('other_id')
    if uid and other_id:
        room = f"dm_{min(uid, other_id)}_{max(uid, other_id)}"
        emit('user_stop_typing', {'user_id': uid}, room=room, include_self=False)


@socketio.on('message_seen')
def on_message_seen(data):
    uid = session.get('user_id')
    sender_id = data.get('sender_id')
    if uid and sender_id:
        Message.query.filter_by(sender_id=sender_id, receiver_id=uid, is_seen=False).update({'is_seen': True})
        db.session.commit()
        emit('messages_seen', {'by': uid}, room=f"user_{sender_id}")


# ---------------------------------------------------------------------------
# Init DB and run
# ---------------------------------------------------------------------------

def create_tables():
    with app.app_context():
        db.create_all()


if __name__ == '__main__':
    create_tables()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
