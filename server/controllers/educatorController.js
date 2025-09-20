import { v2 as cloudinary } from 'cloudinary'
import Course from '../models/Course.js';
import { Purchase } from '../models/Purchase.js';
import User from '../models/User.js';
import { clerkClient } from '@clerk/express'

// update role to educator
export const updateRoleToEducator = async (req, res) => {

    try {

        const userId = req.auth.userId

        await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: 'educator',
            },
        })

        res.json({ success: true, message: 'You can publish a course now' })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }

}

// Add New Course
export const addCourse = async (req, res) => {

    try {

        const { courseData } = req.body

        const imageFile = req.file

        const educatorId = req.auth.userId

        if (!imageFile) {
            return res.json({ success: false, message: 'Thumbnail Not Attached' })
        }

        const parsedCourseData = await JSON.parse(courseData)

        parsedCourseData.educator = educatorId

        const newCourse = await Course.create(parsedCourseData)

        const imageUpload = await cloudinary.uploader.upload(imageFile.path)

        newCourse.courseThumbnail = imageUpload.secure_url

        await newCourse.save()

        res.json({ success: true, message: 'Course Added' })

    } catch (error) {

        res.json({ success: false, message: error.message })

    }
}

// Update Course
export const updateCourse = async (req, res) => {
    console.log('UPDATE COURSE CALLED');
    console.log('Course ID:', req.params.courseId);
    console.log('Educator ID:', req.auth.userId);
    
    try {
        const { courseId } = req.params;
        const { courseData } = req.body;
        const imageFile = req.file;
        const educatorId = req.auth.userId;

        console.log('Course data received:', !!courseData);
        console.log('Image file received:', !!imageFile);

        // Check if the course exists and belongs to the educator
        const course = await Course.findOne({ _id: courseId, educator: educatorId });

        if (!course) {
            console.log('Course not found or permission denied');
            return res.json({
                success: false,
                message: "Course not found or you don't have permission to edit this course"
            });
        }

        console.log('Course found, updating...');
        const parsedCourseData = JSON.parse(courseData);

        // Update course fields
        course.courseTitle = parsedCourseData.courseTitle;
        course.courseDescription = parsedCourseData.courseDescription;
        course.coursePrice = parsedCourseData.coursePrice;
        course.discount = parsedCourseData.discount;
        course.courseContent = parsedCourseData.courseContent;

        // Update thumbnail if new image is provided
        if (imageFile) {
            console.log('Uploading new image...');
            const imageUpload = await cloudinary.uploader.upload(imageFile.path);
            course.courseThumbnail = imageUpload.secure_url;
        }

        await course.save();
        console.log('Course saved successfully');

        res.json({ success: true, message: 'Course updated successfully' });

    } catch (error) {
        console.error('Update course error:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get Single Course for Editing
export const getCourseForEdit = async (req, res) => {
    try {
        const { courseId } = req.params;
        const educatorId = req.auth.userId;

        const course = await Course.findOne({ _id: courseId, educator: educatorId });

        if (!course) {
            return res.json({
                success: false,
                message: "Course not found or you don't have permission to edit this course"
            });
        }

        res.json({ success: true, course });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

// Get Educator Courses
export const getEducatorCourses = async (req, res) => {
    try {

        const educator = req.auth.userId

        const courses = await Course.find({ educator })

        res.json({ success: true, courses })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// Get Educator Dashboard Data ( Total Earning, Enrolled Students, No. of Courses)
export const educatorDashboardData = async (req, res) => {
    try {
        const educator = req.auth.userId;

        const courses = await Course.find({ educator });

        const totalCourses = courses.length;

        const courseIds = courses.map(course => course._id);

        // Calculate total earnings from purchases
        const purchases = await Purchase.find({
            courseId: { $in: courseIds },
            status: 'completed'
        });

        const totalEarnings = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

        // Collect unique enrolled student IDs with their course titles
        const enrolledStudentsData = [];
        for (const course of courses) {
            const students = await User.find({
                _id: { $in: course.enrolledStudents }
            }, 'name imageUrl');

            students.forEach(student => {
                enrolledStudentsData.push({
                    courseTitle: course.courseTitle,
                    student
                });
            });
        }

        res.json({
            success: true,
            dashboardData: {
                totalEarnings,
                enrolledStudentsData,
                totalCourses
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Enrolled Students Data with Purchase Data
export const getEnrolledStudentsData = async (req, res) => {
    try {
        const educator = req.auth.userId;

        // Fetch all courses created by the educator
        const courses = await Course.find({ educator });

        // Get the list of course IDs
        const courseIds = courses.map(course => course._id);

        // Fetch purchases with user and course data
        const purchases = await Purchase.find({
            courseId: { $in: courseIds },
            status: 'completed'
        }).populate('userId', 'name imageUrl').populate('courseId', 'courseTitle');

        // enrolled students data
        const enrolledStudents = purchases.map(purchase => ({
            student: purchase.userId,
            courseTitle: purchase.courseId.courseTitle,
            purchaseDate: purchase.createdAt
        }));

        res.json({
            success: true,
            enrolledStudents
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
};

// Delete Course
export const deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const educator = req.auth.userId;

        // Check if the course exists and belongs to the educator
        const course = await Course.findOne({ _id: courseId, educator });

        if (!course) {
            return res.json({
                success: false,
                message: "Course not found or you don't have permission to delete this course"
            });
        }

        // Check if there are enrolled students
        if (course.enrolledStudents.length > 0) {
            return res.json({
                success: false,
                message: "Cannot delete course with enrolled students"
            });
        }

        // Delete the course
        await Course.findByIdAndDelete(courseId);

        res.json({
            success: true,
            message: "Course deleted successfully"
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
};
